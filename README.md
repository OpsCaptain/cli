![OpsCaptain logo](https://www.opscaptain.com/oc_logo_rd.png)

[OpsCaptain is a Heroku alternative PaaS](https://www.opscaptain.com/) based on docker containers, open source buildpacks and integrated MongoDB built for developers to host applications of any size and scope.

This document provides a general guide on how to use the OpsCaptain CLI.

## Installing the CLI

The CLI is a Node.js program and can be installed using the popular Node.js package manager npm. Simply use the below command to install the CLI.

```
$ npm install -g opscaptain-cli
```

## Authentication

Your API key or the combination of your email and password can be used to authenticate your account when using the CLI. Use `oc login` to initiate the authentication process. Once authenticated, you remain logged in on the device until you run `oc logout`.
```
$ oc login
$ Enter your email address or access key: 
```
***Note:*** *In some cases it is convenient to pass your credentials as parameters to the `oc login` command as seen in the below example. This could pose a security risk as a malicious user with access to your bash history can obtain your credentials*
```
$ oc login -em <thy_email_addresss> -pw <thy_password>
$ oc login -k <thy_api_key>
```

## Deploying

Lets assume an application with name `thycaptain` has been created from the dashboard. The `oc deploy -n thycaptain` command can be used to deploy this application after you `CD` into the project root folder.

#### Deploy command parameters
*Unless stated as a required parameter, please consider the parameter as optional*

* `-n` **(required)** - Specify the name of the application to which the codebase will be deployed to.
* `-e` - Specify the absolute or relative path to the JSON file containing your environment variables if any. Use format as seen below:
```
{
  "ROOT_URL" : "https://thycaptain-1.opscaptian.com/", 
  "KEY": ""
}
```
* `-ev` - You can also specify environment variables using this switch as seen below:
```
$ oc deploy -n thycaptain -ev "VAR1=For thy shall obey thy captain" -ev "var1=value"
```
* `-p` - If the directory in which the deploy command was run is not the directory one intends to deploy, you can use this switch to specify the absolute or relative path to the target directory or build artifact.
* `-bp` - Specify the buildpack(s) to be used to build this application. For multiple buildpacks, separate each value with a comma.
* `--ruas` - On rolling updates, the number of seconds to wait before committing this update. Use this parameter to mitigate downtime when you push updates. Specify value as an integer in seconds.
* `--rups` - On rolling updates where application startup time is variable, specifying this flag will await for the new container to bind to the assigned port before commiting this update.
* `--cmd` - If you have a Procfile and want to run any command other than the default web command you can use this parameter to specify the command to run.

## Logs

You can view your logs from the command line using the `oc logs -n thyappname' command.