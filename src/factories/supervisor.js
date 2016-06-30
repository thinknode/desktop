/*
 * Supervisor Factory
 *
 * Copyright (c) 2015 Thinknode Labs, LLC. All rights reserved.
 */

(function() {
    'use strict';

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Factory

    function supervisorFactory($environment, $session, $manifest, $rootScope, $http) {

        // --------------------------------------------------
        // Required modules

        var _ = require('lodash');
        var bluebird = require('bluebird');
        var crypto = require('crypto');
        var events = require('events');
        var fs = bluebird.promisifyAll(require('fs-extra'));
        var net = require('net');
        var stream = require('stream');
        var request = require('request');
        var util = require('util');

        // --------------------------------------------------
        // Constants

        var ure = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

        var calculations = $environment.db().getSchema().table('calculations');

        var error_templates = {
            "invalid_buffer_state": "Received extraneous data in buffer given current state",
            "invalid_failure_state": "Received failure message while in an invalid state",
            "invalid_ipc_code": "Invalid IPC message code (?)",
            "invalid_ipc_protocol": "Invalid IPC protocol (?)",
            "invalid_ipc_reserved": "Invalid IPC reserved byte value (?)",
            "invalid_ipc_version": "Invalid IPC version (?)",
            "invalid_pong_content": "Pong message body does not match ping value",
            "invalid_pong_state": "Received progress message while in an invalid state",
            "invalid_pong_length": "Invalid pong body length (?)",
            "invalid_progress_state": "Received progress message while in an invalid state",
            "invalid_registration_length": "Invalid registration body length (?)",
            "invalid_registration_state": "Received registration message while in an invalid state",
            "invalid_registration_pid": "Invalid attempt to register with unknown pid (?)",
            "invalid_result_state": "Received result message while in an invalid state",
            "unresponsive_provider": "The provider has become unresponsive",
            "unsupported_ipc_protocol": "The ? IPC protocol is not currently supported",
        };

        // --------------------------------------------------
        // Local functions

        function readString(buffer, offset, length) {
            return buffer.toString('utf8', offset, offset + length);
        }

        function readUInt8(buffer, offset, length) {
            return buffer.readUInt8(offset);
        }

        function readUInt16(buffer, offset, length) {
            return buffer.readUInt16BE(offset);
        }

        function readUInt32(buffer, offset, length) {
            return buffer.readUInt32BE(offset);
        }

        function readFloatBE(buffer, offset, length) {
            return buffer.readFloatBE(offset);
        }

        // --------------------------------------------------
        // Constructor

        function Supervisor() {
            events.EventEmitter.call(this);

            this._cpid = '62c0464c874d115cb77423eecb85ee26';
            this._calculation = null;

            // Read data
            this._buffers = [];
            this._offset = 0; // Current offset in the first buffer
            this._length = 0; // Length of all buffers minus offset
            this._bodyLength = null;

            // Result information
            this._resultLength = null;

            // Write data
            this._header = new Buffer(8);
            this._header.fill(0);
            this._buint8 = new Buffer(1);
            this._buint16 = new Buffer(2);
            this._buint32 = new Buffer(4);

            // Socket state
            this._mode = 0; // 0: header; 1: body; 2: flowing
            this._version = null;
            this._code = null;

            // Task state
            this._status = 0; // 0: idle; 1: registered; 2: staged; 4: running; 8: uploading; 16: completed
            this._protocol = null;
            this._pid = null;

            // Calculation status
            this._updated_at = 0;
            this._progress = 0;

            // Tcp server and socket
            this._server = new net.Server(this._onConnection.bind(this));
            this._socket = null;

            // Promisified methods
            var ctx = {
                'context': this._server
            };
            this.listen = bluebird.promisify(this._server.listen, ctx);
            this._close = bluebird.promisify(this._server.close, ctx);
        }
        util.inherits(Supervisor, events.EventEmitter);

        // --------------------------------------------------
        // Server event handlers

        Supervisor.prototype._onConnection = function(socket) {

            // Ensure only one socket is connected at a time
            if (this._socket) {
                this._notify('warning', "Calculation provider already connected");
                socket.destroy();
                return;
            }
            this._notify('debug', 'Socket connection opened');

            // Assign socket and listen to events
            this._socket = socket;
            this._socket.on('data', this._onData.bind(this));
            this._socket.on('error', this.onError.bind(this));
            this._socket.on('end', this.onEnd.bind(this));
        };

        // --------------------------------------------------
        // Socket event handlers

        Supervisor.prototype._onData = function(data) {
            this._buffers.push(data);
            this._length += data.length;
            this._read();
        };

        Supervisor.prototype.onEnd = function() {
            this._socket.destroy();
            this._socket = null;
            this._notify('debug', 'Socket connection closed');
            this._notify('close', null);
            // Reinitialize
            this._init();
            this._status = this._status & 2;
        };

        Supervisor.prototype.onError = function(e) {
            this._socket.destroy();
            self._socket = null;
            this._notify('error', e.message);
            this._notify('close', null);
        };

        // --------------------------------------------------
        // Private methods

        /**
         * @summary Completes the calculation.
         */
        Supervisor.prototype._complete = function() {
            // Reinitialize
            this._init();
            // Resolve
            this._resolve();
        };

        Supervisor.prototype._consume = function(fcn, length) {
            var value;

            // Decrement buffered length by consumption amount
            this._length -= length;

            if (length === 0) {
                return null;
            }

            // Handle whether or not first buffer has enough bytes
            if (this._offset + length <= this._buffers[0].length) {

                // Consume value from first buffer
                value = fcn(this._buffers[0], this._offset, length);
                this._offset += length;

                // Consumed entire first buffer, remove it from the buffers array
                if (this._offset === this._buffers[0].length) {
                    this._offset = 0;
                    this._buffers.shift();
                }

                // Return value
                return value;
            } else {

                // Value must span multiple buffers, create temporary buffer
                var buf = new Buffer(length);
                var buf_pos = 0;

                // Process buffers while there are remaining bytes
                var rem = length;
                while (rem > 0) {

                    // Determine number of bytes that can be processed from first buffer
                    var len = Math.min(rem, this._buffers[0].length - this._offset);

                    // Copy the available bytes from the first buffer and increment the indices
                    this._buffers[0].copy(buf, buf_pos, this._offset, this._offset + len);
                    buf_pos += len;
                    rem -= len;

                    // Move to the next buffer or set the offset
                    if (len === (this._buffers[0].length - this._offset)) {
                        this._offset = 0;
                        this._buffers.shift();
                    } else {
                        this._offset += len;
                    }
                }

                // Parse value from temporary buffer and return
                value = fcn(buf, 0, length);
                return value;
            }
        };

        /**
         * @private
         * @summary Fails the calculation with a critical error message.
         *
         * @param {string} type - The error type.
         * @param {string} [param] - The replacement parameter (optional).
         */
        Supervisor.prototype._critical = function(type, param) {
            var message = error_templates[type].replace('?', param);
            this._fail(type, null, message);
            return false;
        };

        /**
         * @private
         * @summary Ends the underlying result stream, optionally writing some final data.
         * @description
         * Call this method when no more data will be written to the result stream. Once called, 
         * the supervisor will finalize and complete the calculation since the promise
         * chain initiated during the call to compose will resolve.
         *
         * @param {string|buffer} [data] - Optional data to write.
         */
        Supervisor.prototype._end = function(data) {
            this._output.end(data);
        };

        /**
         * @private
         * @summary Marks a calculations as failed.
         *
         * @param {string} type - The failure type.
         * @param {string} code - The failure code.
         * @param {string} message - The failure message.
         */
        Supervisor.prototype._fail = function(type, code, message) {
            var msg = 'Received failure message with type `' + type + '`, code `' + code;
            msg += '` and message "' + message + '"';
            this._notify('debug', msg);
            this._calculation.failure = {
                "type": type,
                "code": code,
                "message": message
            };
            this._complete();
        };

        /**
         * @private
         * @summary Finalizes the current message.
         * @description
         * This function is responsible for finalizing the current message, indicating that the 
         * next data received will begin with a new message header.
         *
         * @returns {boolean} Indicates whether the message was successful (true), or 
         *   failed (false).
         */
        Supervisor.prototype._finalizeMessage = function(pause) {
            this._bodyLength = null;
            this._mode = 0;
            this._version = null;
            this._code = null;

            // Ensure the provider has not sent us extra information
            if (pause) {
                this._socket.pause();
                if (this._length !== 0) {
                    return this._critical("invalid_buffer_state");
                }
            }
            return true;
        };

        /**
         * @private
         * @summary Reinitializes the supervisor state.
         */
        Supervisor.prototype._init = function() {
            // Reinitialize read data state
            this._buffers = [];
            this._offset = 0; // Current offset in the first buffer
            this._length = 0; // Length of all buffers minus offset
            this._bodyLength = null;
            // Reinitialize socket state
            this._mode = 0; // 0: header; 1: body; 2: flowing
            this._version = null;
            this._code = null;
            // Reinitialize calculation task status
            this._status = 1;
            this._updated_at = 0;
            this._progress = 0;
        };

        /**
         * @private
         * @summary Notifies the proxy of an event.
         *
         * @param {string} type - The message type.
         * @param {object|string} message - The message content.
         */
        Supervisor.prototype._notify = function(type, message) {
            this.emit('notification', {
                "type": type,
                "message": message
            });
        };

        /**
         * @private
         * @summary Pipes the current buffered data into the result output.
         * @description
         * This function is responsible for writing the existing buffered data into the result 
         * output.
         *
         * @returns {boolean} True, indicating that data was processed.
         */
        Supervisor.prototype._pipeResult = function() {
            var length;
            if (this._resultLength === 0) {
                return false;
            }
            while (this._resultLength > 0 && this._length > 0) {

                // Handle whether or not first buffer contains the remaining data
                if (this._offset + this._resultLength <= this._buffers[0].length) {

                    // Reading entire remaining data
                    length = this._resultLength;

                    // End passthrough stream with remaining data
                    this._end(this._buffers[0].slice(this._offset, this._offset + length));

                    // Increment counters
                    this._resultLength -= length;
                    this._length -= length;
                    this._offset += length;

                    // Remove first buffer if entirely consumed
                    if (this._offset === this._buffers[0].length) {
                        this._offset = 0;
                        this._buffers.shift();
                    }
                } else {

                    // Reading entire buffer (less than remaining)
                    length = this._buffers[0].length - this._offset;

                    // Write entire buffer to passthrough stream
                    this._write(this._buffers[0].slice(this._offset));

                    // Increment counters and remove first buffer
                    this._resultLength -= length;
                    this._length -= length;
                    this._offset = 0;
                    this._buffers.shift();
                }
            }

            // Return true
            return true;
        };

        /**
         * @private
         * @summary Attempts to read data from the buffer.
         * @description
         * This function is responsible for calling the appropriate data handler to read the 
         * buffered data based on the current state of the supervisor.
         */
        Supervisor.prototype._read = function() {
            var prev = 0;
            var processed = false;
            while (this._length > 0 && (processed === true || prev !== this._length) && !this.finished) {
                prev = this._length;
                processed = false;

                // Read data from buffers
                if (this._mode === 0) {
                    processed = this._readHeader();
                } else if (this._mode === 2) {
                    processed = this._pipeResult();
                } else if (this._code === 0) {
                    processed = this._readRegistration();
                } else if (this._code === 2) {
                    processed = this._readProgress();
                } else if (this._code === 3) {
                    processed = this._readResult();
                } else if (this._code === 4) {
                    processed = this._readFailure();
                } else if (this._code === 6) {
                    processed = this._readPong();
                } else {
                    processed = this._critical("invalid_ipc_code", this._code);
                }
            }
        };

        /**
         * @private
         * @summary Attempts to read failure message data from the internal buffer.
         *
         * @returns {boolean} True, if the failure body was read; otherwise, false.
         */
        Supervisor.prototype._readFailure = function() {
            if (this._status !== 4) {
                return this._critical("invalid_failure_state");
            } else if (this._length < this._bodyLength) {
                return false;
            }

            // Read failure code
            var code_length = this._consume(readUInt8, 1);
            var code = this._consume(readString, code_length);

            // Read failure message
            var message_length = this._consume(readUInt16, 2);
            var message = this._consume(readString, message_length);

            // Finalize message
            this._finalizeMessage(true);

            // Fail calculation and return true
            this._fail("provider_error", code, message);
            return true;
        };

        /**
         * @private
         * @summary Attempts to read header data from the internal buffer.
         *
         * @returns {boolean} True, if the header was read; otherwise, false.
         */
        Supervisor.prototype._readHeader = function() {
            if (this._length < 8) {
                return false;
            }

            // Parse and validate version
            this._version = this._consume(readUInt8, 1);
            if (this._version !== 0) {
                return this._critical("invalid_ipc_version", this._version);
            }

            // Parse first reserved byte
            var reserved = this._consume(readUInt8, 1);
            if (reserved !== 0) {
                return this._critical("invalid_ipc_reserved", reserved);
            }

            // Parse message code
            this._code = this._consume(readUInt8, 1);
            if (this._code > 6) {
                return this._critical("invalid_ipc_code", this._code);
            }

            // Parse second reserved byte
            reserved = this._consume(readUInt8, 1);
            if (reserved !== 0) {
                return this._critical("invalid_ipc_reserved", reserved);
            }

            // Parse body length
            this._bodyLength = this._consume(readUInt32, 4);

            // Assign state and return true
            this._mode = 1;
            return true;
        };

        /**
         * @private
         * @summary Attempts to read pong message data from the internal buffer.
         *
         * @returns {boolean} True, if the pong body was read; otherwise, false.
         */
        Supervisor.prototype._readPong = function() {
            if (this._status & 1 !== 1) {
                return this._critical("invalid_pong_state");
            } else if (this._bodyLength !== 32) {
                return this._critical("invalid_pong_length", this._bodyLength);
            } /* istanbul ignore next: Impossible to consistently cover due to socket timing */
            else if (this._length < this._bodyLength) {
                return false;
            }

            // We have all the data, so clear pong timeout
            clearTimeout(this._pong_timeout);

            // Read pong value
            var pong = this._consume(readString, 32);

            // Check that pong matches ping
            if (this._ping !== pong) {
                return this._critical("invalid_pong_content", this._bodyLength);
            } else {

                // Finalize message, resolve ping, and return true
                this._finalizeMessage();
                this._ping_resolve();
                this._ping_resolve = null;
                return true;
            }
        };

        /**
         * @private
         * @summary Attempts to read progress message data from the internal buffer.
         *
         * @returns {boolean} True, if the progress body was read; otherwise, false.
         */
        Supervisor.prototype._readProgress = function() {
            if (this._status !== 4) {
                return this._critical("invalid_progress_state");
            } else if (this._length < this._bodyLength) {
                return false;
            }

            // Read (and clamp) progress value
            var progress = this._consume(readFloatBE, 4);
            progress = ((progress < 0) ? 0 : (progress > 1 ? 1 : progress));

            // Read progress message
            var message_length = this._consume(readUInt16, 2);
            var message = this._consume(readString, message_length);


            // Update calculation progress
            var now = Date.now();
            if (((now - this._updated_at) > 500) && progress !== this._progress) {
                this._updated_at = now;
                this._progress = progress;
                var msg = 'Received progress update with value `' + progress;
                msg += '` and message "' + message + '"';
                this._notify('debug', msg);
            }

            // Finalize message and return true
            this._finalizeMessage();
            return true;
        };

        /**
         * @private
         * @summary Attempts to read registration message data from the internal buffer.
         *
         * @returns {boolean} True, if the registration body was read; otherwise, false.
         */
        Supervisor.prototype._readRegistration = function() {
            if (this._status !== 0 && this._status !== 2) {
                return this._critical("invalid_registration_state");
            } else if (this._bodyLength !== 34) {
                return this._critical("invalid_registration_length", this._bodyLength);
            } else if (this._length < this._bodyLength) {
                return false;
            }

            // Parse and validate protocol
            this._protocol = this._consume(readUInt16, 2);
            if (this._protocol > 1) {
                return this._critical("invalid_ipc_protocol", this._protocol);
            } else if (this._protocol === 1) {
                return this._critical("unsupported_ipc_protocol", 'JSON');
            }

            // Parse pid
            this._pid = this._consume(readString, 32);
            if (this._pid !== this._cpid) {
                return this._critical("invalid_registration_pid", this._pid);
            }

            // Finalize message
            this._finalizeMessage();
            this._notify('debug', 'Provider registered successfully');

            // Assign state
            this._status = this._status | 1;
            // If we have registered and a calculation is ready, write the request.
            if ((this._status & 3) === 3) {
                this._writeRequest();
            } else {
                this._notify('state', 'registered');
            }

            // Return true
            return true;
        };

        /**
         * @private
         * @summary Attempts to read result message data from the internal buffer.
         *
         * @returns {boolean} True, if the result body was read; otherwise, false.
         */
        Supervisor.prototype._readResult = function() {
            if (this._status !== 4) {
                return this._critical("invalid_result_state");
            }
            this._notify('debug', 'Reading result from provider');

            // Construct passthrough stream
            this._resultLength = this._bodyLength;

            // Change mode to flowing and status to uploading
            this._mode = 2;
            this._status = 8;
            // this._task.status = 'uploading';

            // Get the result schema and begin composing the result
            var uuid = this._calculation.uuid;
            var schema = this._calculation.declaration.schema.function_type.returns.schema;
            var type = $manifest.stringify(schema);

            // Create result output stream
            this._output = new stream.PassThrough();

            // Begin output promise chain
            bluebird.bind(this).then(function() {
                var self = this;
                return new bluebird(function(resolve, reject) {
                    var stream = self._output.pipe(fs.createWriteStream($environment.cache(uuid)));
                    stream.on('close', resolve);
                    stream.on('error', reject);
                });
            }).then(function() {
                var self = this;
                return new bluebird(function(resolve, reject) {
                    fs.createReadStream($environment.cache(uuid)).pipe(request({
                        method: "POST",
                        url: $session.url('/iss/:type', {
                            'type': type
                        }, {
                            'context': self._context
                        }, true),
                        headers: {
                            'Authorization': 'Bearer ' + $session.token(),
                            'Content-type': 'application/octet-stream'
                        }
                    }, function(err, response, body) {
                        if (err) {
                            reject(err);
                        } else {
                            try {
                                if (response.statusCode === 200) {
                                    resolve(JSON.parse(body));
                                } else {
                                    reject(JSON.parse(body));
                                }
                            } catch (perr) {
                                reject(perr);
                            }
                        }
                    }));
                });
            }).then(function(res) {
                this._calculation.id = res.id;
                var src = $environment.cache(this._calculation.uuid);
                var dest = $environment.cache(this._calculation.id);
                return fs.copyAsync(src, dest);
            }).then(function() {
                this._notify('debug', 'Done reading result from provider');
                this._complete();
            });

            // Return true
            return true;
        };

        /**
         * @private
         * @summary Writes some data (binary or string) to the underlying result stream.
         *
         * @param {string|buffer} data - The data to write.
         */
        Supervisor.prototype._write = function(data) {
            this._output.write(data);
        };

        /**
         * @private
         * @summary Writes header information to the provider stream.
         *
         * @param {number} version - The protocol version.
         * @param {number} code - The action code of the message.
         * @param {number} length - The body length.
         */
        Supervisor.prototype._writeHeader = function(version, code, length) {
            this._header.writeUInt8(version, 0);
            this._header.writeUInt8(code, 2);
            this._header.writeUInt32BE(length, 4);
            this._socket.write(this._header);
        };

        /**
         * @private
         * @summary Writes the function request information to the provider stream.
         */
        Supervisor.prototype._writeRequest = function() {
            var self = this;

            // Get current function request object
            var fcn = this._calculation.request.function;

            this._notify('debug', 'Sending calculation request to provider');
            return bluebird.bind(this).then(function() {
                return fcn.args;
            }).each(function(arg, index) {

                // Download each argument to local cache
                return bluebird.bind(this).then(function() {
                    if (!ure.test(arg.reference)) {
                        return arg.reference;
                    }

                    // Lookup remote id from local uuid
                    return bluebird.bind(this).then(function() {
                        var filter = calculations.uuid.eq(arg.reference);
                        return $environment.db()
                            .select(calculations.id)
                            .from(calculations)
                            .where(filter)
                            .exec();
                    }).then(function(rows) {
                        arg.reference = rows[0].id;
                        return rows[0].id;
                    });
                }).then(function(id) {
                    return fs.statAsync($environment.cache(id)).catch(function(err) {
                        /* jshint newcap: false */
                        return new bluebird(function(resolve, reject) {
                            var stream = request({
                                "method": "GET",
                                "url": $session.url('/iss/:id', {
                                    "id": id
                                }, {
                                    "context": self._context
                                }, true),
                                "headers": {
                                    "Authorization": 'Bearer ' + $session.token(),
                                    "Accept": 'application/octet-stream'
                                }
                            }).pipe(fs.createWriteStream($environment.cache(id)));
                            stream.on('close', resolve);
                            stream.on('error', reject);
                        }).then(function() {
                            return fs.statAsync($environment.cache(id));
                        });
                    }).then(function(stats) {
                        arg.size = stats.size;
                    });
                });
            }).then(function() {

                // Determine name string length and argument count            
                var name_length = Buffer.byteLength(fcn.name, 'utf8');
                var args_count = fcn.args.length;

                // Determine body length
                var body_length = 0;
                body_length += 1; // name length
                body_length += name_length; // name
                body_length += 2; // argument count
                body_length += args_count * 4; // argument count * argument length
                for (var i = 0; i < args_count; ++i) {
                    body_length += fcn.args[i].size; // argument body size
                }

                // Write header, name length, name and argument count
                this._writeHeader(this._version, 1, body_length);
                this._writeUInt8(name_length);
                this._writeString(fcn.name);
                this._writeUInt16(args_count);

                // Return arguments
                return fcn.args;
            }).each(function(arg, index) {

                // Stream argument size to provider
                this._writeUInt32(arg.size);

                // Stream argument value to provider
                return bluebird.bind(this).then(function() {
                    return fs.createReadStream($environment.cache(arg.reference));
                }).then(function(stream) {
                    return new bluebird(function(resolve, reject) {
                        stream.on("data", function(chunk) {
                            self._socket.write(chunk);
                        });
                        stream.on("close", resolve);
                        stream.on("error", reject);
                    });
                });
            }).then(function() {

                // Assign status
                this._status = 4;
                this._notify('debug', 'Done sending calculation request to provider');

                // Resume socket
                self._socket.resume();
            });
        };

        /**
         * @private
         * @summary Writes a string to the provider stream.
         *
         * @param {string} value - The string to write.
         */
        Supervisor.prototype._writeString = function(value) {
            this._socket.write(value, 'utf8');
        };

        /**
         * @private
         * @summary Writes an unsigned 8-bit number to the provider stream.
         *
         * @param {number} value - The number to write.
         */
        Supervisor.prototype._writeUInt8 = function(value) {
            this._buint8.writeUInt8(value, 0);
            this._socket.write(this._buint8);
        };

        /**
         * @private
         * @summary Writes an unsigned 16-bit number to the provider stream.
         *
         * @param {number} value - The number to write.
         */
        Supervisor.prototype._writeUInt16 = function(value) {
            this._buint16.writeUInt16BE(value, 0);
            this._socket.write(this._buint16);
        };

        /**
         * @private
         * @summary Writes an unsigned 32-bit number to the provider stream.
         *
         * @param {number} value - The number to write.
         */
        Supervisor.prototype._writeUInt32 = function(value) {
            this._buint32.writeUInt32BE(value, 0);
            this._socket.write(this._buint32);
        };

        // --------------------------------------------------
        // Public methods

        Supervisor.prototype.close = function() {
            if (this._socket) {
                this._socket.destroy();
                this._socket = null;
            }
            return this._close();
        };

        Supervisor.prototype.context = function(value) {
            this._context = value;
        };

        Supervisor.prototype.init = function() {
            this._init();
            this._status = this._status & 2;
        };

        Supervisor.prototype.pid = function() {
            return this._cpid;
        };

        Supervisor.prototype.ping = function() {
            var self = this;
            return new bluebird(function(resolve, reject) {
                self._ping_resolve = resolve;
                self._ping = crypto.randomBytes(16).toString('hex');
                self._writeHeader(self._version, 5, 32);
                self._writeString(self._ping);
                self._pong_timeout = setTimeout(function() {
                    self._notify("error", "Provider did not respond to ping with pong within 2s.");
                }, 2000);
            });
        };

        Supervisor.prototype.stage = function(calculation) {
            // Assign status
            this._calculation = calculation;
            this._status = this._status | 2;
            if ((this._status & 3) === 3) {
                this._writeRequest();
            }

            // Return deferred promise
            var self = this;
            return new bluebird(function(resolve, reject) {
                self._resolve = resolve;
                self._reject = reject;
            });
        };

        // --------------------------------------------------
        // Return class

        return Supervisor;
    }


    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Register factory

    angular.module('app').factory('Supervisor', [
        '$environment',
        '$session',
        '$manifest',
        supervisorFactory
    ]);
})();