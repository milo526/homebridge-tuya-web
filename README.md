<p align="center">
  <img src="https://github.com/homebridge/branding/blob/master/logos/homebridge-wordmark-logo-horizontal.png?raw=true" height="200px">  
</p>
<span align="center">

# Homebridge Tuya Web

[![GitHub release](https://img.shields.io/github/release/milo526/homebridge-tuya-web.svg)](https://github.com/milo526/homebridge-tuya-web/releases)
[![npm](https://img.shields.io/npm/dm/@milo526/homebridge-tuya-web.svg)](https://www.npmjs.com/package/@milo526/homebridge-tuya-web)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Homebridge Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.gg/hZubhrz)
[![GitHub issues](https://img.shields.io/github/issues/milo526/homebridge-tuya-web)](https://github.com/milo526/homebridge-tuya-web/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/milo526/homebridge-tuya-web)](https://github.com/milo526/homebridge-tuya-web/pulls)
[![Contribute](https://img.shields.io/badge/contribute-donate%20a%20coffee-brightgreen)](https://bunq.me/HomebridgeTuyaWeb)

</span>

## Overview

Homebridge plugin for Tuya devices using a cloud Tuya Web Api.

This Homebridge plugin is based on the Home Assistent Tuya integration that implements a special Tuya Home Assistant API.

See [Home Assistant Tuya integration](https://www.home-assistant.io/components/tuya/) and [Tuyaha python library](https://github.com/PaulAnnekov/tuyaha).

## Features

This Homebridge Plugin implements the following features:

- Controlling Tuya WiFi enabled devices form within HomeKit enabled iOS Apps.
- Uses simple and lightweight Cloud Web API to control and get state update from Tuya devices. You will need a stable internet connection to control the devices.
- Device State Caching. State of devices is cached in memory, every time a HomeKit app request status updates from the devices this results in a very fast and responsive response. There can be a latency in updates when a device is controlled form an App/Hub/Controller other than HomeKit, e.g. from the Tuya Android/iOS App.

## Installation

```
npm i -g @milo526/homebridge-tuya-web
```

## Support
Please notice that there is no official support for this plugin, for help please [open an issue](https://github.com/milo526/homebridge-tuya-web/issues/new/choose) or see:

<span align="center">

[![Homebridge Discord](https://discordapp.com/api/guilds/432663330281226270/widget.png?style=banner2)](https://discord.gg/kqNCe2D) [![Homebridge Reddit](https://raw.githubusercontent.com/homebridge/homebridge/master/.github/homebridge-reddit.svg?sanitize=true)](https://www.reddit.com/r/homebridge/)

</span>


# Configuration

```json
{
  "platform": "TuyaWebPlatform",
  "name": "TuyaWebPlatform",
  "options":
    {
      "username": "xxxx@gmail.com",
      "password": "xxxxxxxxxx",
      "countryCode": "xx",
      "platform": "tuya"
    }
}
```

The `options` has these properties:

- `username` Required. The username for the account that is registered in the Android/iOS App.
- `password` Required. The password for the account that is registered in the Android/iOS App.
- `countryCode` Required. Your account [country code](https://www.countrycode.org/), e.g., 1 for USA or 86 for China.
- `platform` Optional. The App where you registered your account. `tuya` for Tuya Smart, `smart_life` for Smart Life, `jinvoo_smart` for Jinvoo Smart. Defaults to `tuya`.
- `pollingInterval` Optional. Defaults to empty which entails no polling. The frequency in **seconds** that the plugin polls the cloud to get device updates. When you exclusively control the devices through Homebridge, you can set this to a low frequency (high interval number, e.g. 1800 = 30 minutes).

> :warning: Sign-in with Apple is **not** supported and, due to limitations imposed by Apple, will probably never be supported :warning:  

All options outlines below are optional, they are useful to provide finer control on the working of the plugin.

## Overruling Device Types

It is possible to override values from the default. As of now, only overruling device types is possible. See example configuration below.

```json
{
  "platform": "TuyaWebPlatform",
  "name": "TuyaWebPlatform",
  "options":
    {
      ...
    },
  "defaults": [
    {
      "id": "<device name or id>",
      "device_type": "<desired device type>"
    }
  ]
}
```

The `defaults` has these properties:

- `id` The name or id for the device that is registered in the Android/iOS App. When matching on ID please provide the `Tuya ID` as shown during Homebridge boot.
- `device_type` The `device_type` to be overruled. This can be useful for dimmers that are reported as `light` by the Tuya API and don't support hue and saturation or for outlets that are reported as `switch`.

Note: After overriding the type of a device, it might appear duplicated in both HomeBridge (Accessories Tab) and the Home App. To solve this issue, go to the Homebridge settings (top right corner) and remove the device using the `Remove Single Cached Accessory` option.

## Hiding devices

There are some valid reasons why you might not want to expose certain devices to HomeKit. You might for example have another plugin active which also exposes certain Tuya devices, adding these devices to this list will prevent them from showing up multiple times.

```json
{
  "platform": "TuyaWebPlatform",
  "name": "TuyaWebPlatform",
  "options":
    {
      ...
    },
  "hiddenAccessories": [
    "<device name or id>"
  ]
}
```

## Whitelisting scenes

To prevent an overload of scenes clogging up your HomeKit devices, scenes are by default not exposed to HomeKit. If you wish to add Tuya scenes to homekit you will need to whitelist.

### Add all scenes to HomeKit

You can add all your tuya scenes to HomeKit by setting the `scenes` key to `true`.
```json
{
  "platform": "TuyaWebPlatform",
  "name": "TuyaWebPlatform",
  "options":
    {
      ...
    },
  "scenes": true
}
``` 

### Add specific scenes to HomeKit

To add specific scenes to HomeKit you can set the `scenes` key to true and set `scenesWhitelist` to an array in which you define either the names or ids of the scenes that you'd wish to expose.
```json
{
  "platform": "TuyaWebPlatform",
  "name": "TuyaWebPlatform",
  "options":
    {
      ...
    },
  "scenes": true,
  "scenesWhitelist": [
    "Scene-id",
    "Scene-name"
  ]
}
```

### Add no scenes to HomeKit

To explicitly disable scene support set the `scenes` key to `false`.

# Supported Device Types

There is currently support for the following device types within this Homebridge plugin:

- **Switch/Outlet** - The platform supports switch and outlets/sockets.
- **Light/Dimmer** - The platform supports most types of Tuya lights. This is partly implemented and only currently supports controlling the on/off state and the brightness. This can be used with a dimmer.
- **Fan** - The platform supports most kinds of Tuya fans. This is partly implemented and only currently supports controlling the on/off state and speed control. The plugin lacks support for oscillation due to a Tuya limitation.
- **Scene** - Scenes support can be enabled in the config, this is disabled by default.

The Web API also supports these devices, but are not implemented yet in the plugin.

- **Climate** - Not yet supported.
- **Cover** - Not yet supported.

# How to check whether the API this library uses can control your device?

- Copy [this script](https://github.com/milo526/homebridge-tuya-web/blob/master/tools/debug_discovery.py) to your PC with Python
  installed or to https://repl.it/
- Set/update config inside and run it
- Check if your devices are listed
  - If they are - open an issue and provide the output
  - If they are not - don't open an issue. Ask [Tuya support](mailto:support@tuya.com) to support your device in their 
    `/homeassistant` API
- Remove the updated script, so your credentials won't leak

## TODO

These features are on my wishlist and need to be implemented:

- Implement devices that are not supported yet.

## Unit tests

The source code also has some unit tests to test API calls. Run the following command to run the unit tests.

```
 npm run test
```
