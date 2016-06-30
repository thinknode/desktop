# Thinknode Desktop

[![CircleCI](https://circleci.com/gh/thinknode/desktop.svg?style=shield&circle-token=7955cb410ee3b0556fb1deb5c63782ecf5d444a4)](https://circleci.com/gh/thinknode/desktop)

Client application for exploring and interacting with the Thinknode API

## Development Guide

Developing for the Thinknode Desktop application is a breeze. Get started by satisfying the dependencies, installing the npm and bower packages, and running the application with a grunt task.
  
When editing code, there is no need to restart the application to see your changes reflected; We have enabled live reloading for your convenience. 

### Development Dependencies

Before you get begin developing you must satisfy some dependencies.

First you will want install node and npm. Here is a [resource](https://nodejs.org/en/download/package-manager/) that can guide you through that process. 

Next you will want to install `grunt-cli` and `bower` globally. Run these commands to accomplish this step.

- `npm install -g grunt-cli`
- `npm install -g bower`

This project uses grunt-electron-installer-redhat which requires rpmbuild to
build the .rpm package.


On Fedora you need to install the following:

`$ sudo dnf install rpm-build`

While on Ubuntu you'll need to install this instead:

`$ sudo apt-get install rpm`

For windows you must have a .p12 certificate located below:

`c:\thinknode\code_signing.p12`

### Install

Run the following commands

* `npm install`
* `bower install`

### Run

`grunt start`

## Contribution Guide

### Pull Requests

We **REALLY** appreciate community contributions. We also **REALLY** appreciate the community making our lives a bit easier by adhering to these guidelines.

* Open an issue to discuss the feature you are intending to implement. Someone might already be working on the feature or we might be able to give you feedback and guide your development efforts.
* Make sure to prefix your branch name with `feature/` if it is a feature PR and `bug/` if it is a bug related PR. For example `feature/my-new-feature` or `bug/bugfix`
* Squash all your branch commits into a single commit, so it makes rolling back changes seamless.
* Pull requests should be scoped for one feature only (or one bug fix). Please do not try to scope creep multiple features into one pull request. Having one feature per pull request contributes to an efficient review process, allowing us to review and release your change quickly.
* If you have valid reason to bundle multiple features/bugs together, please reach out so we can discuss.
* Adhere to the coding style in this project. Yes! We will reject pull requests that are not consistent in style. This is for the greater good of the community of other developers who want to be able to easily read the code.
* Don't go rogue and make expansive stylistic changes to code outside the scope of your feature. If you want to do this, please open a separate PR just for this cause.
* Test your feature thoroughly. We understand that this project contains no unit tests (contributions welcomed). This doesn't mean that we don't care about quality, we just haven't got around to it yet.  
* We recommend creating a native installer with your feature to test it out prior to your PR. See our [guide](https://github.com/thinknode/desktop/wiki#creating-a-native-installer) on how to do that.
* Don't try to submit the installer that contains your feature. We will build the installers as part of the official releases.
* Update the README if appropriate.
* Open up a channel of communication with us before making sweeping UI changes. We love aesthetic improvements, but these types of changes can have impactful meaning to other's work in the development pipeline.
* Make sure that your PR passes the CircleCI build.

### Bug Reporting

We hate to see bugs, but we appreciate your involvement in finding them. Here are some guidelines to help us keep the process of reporting bugs sane.

* Search existing issues first before blindly reporting a bug because there is a chance someone has found the same thing. It also helps us to keep our backlog lean.
* Your bug report should contain the operating system you are using, an explanation of the expected behavior, and an explanation of the actual behavior. Code samples on how to fix the bug are welcomed. Any assets showcasing the bug, such as screencasts, screenshots, etc are encouraged.
* Bugs related to security vulnerabilities should be emailed to support@thinknode.com. Please include "Security!" as the prefix in your subject line. We treat security as a first class citizen above all other bugs, so this helps us prioritize these to the top of our backlog.

If you have any questions about anything, please don't hesitate to email us at developers@thinknode.com

## License

See [License](https://github.com/thinknode/desktop/blob/master/LICENSE)