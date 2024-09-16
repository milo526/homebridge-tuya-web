<span style="text-align: center">

# Tuya Web

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![certified-by-hoobs](https://badgen.net/badge/hoobs/certified/yellow)](https://plugins.hoobs.org/plugin/@milo526/homebridge-tuya-web)

[![npm](https://img.shields.io/npm/v/@milo526/homebridge-tuya-web/latest?label=latest)](https://www.npmjs.com/package/@milo526/homebridge-tuya-web)
[![npm](https://img.shields.io/npm/v/@milo526/homebridge-tuya-web/next?label=next)](https://www.npmjs.com/package/@milo526/homebridge-tuya-web/v/next)
[![npm](https://img.shields.io/npm/dt/@milo526/homebridge-tuya-web)](https://www.npmjs.com/package/@milo526/homebridge-tuya-web)
[![GitHub release](https://img.shields.io/github/release/milo526/homebridge-tuya-web.svg)](https://github.com/milo526/homebridge-tuya-web/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Homebridge Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.gg/hZubhrz)
[![GitHub issues](https://img.shields.io/github/issues/milo526/homebridge-tuya-web)](https://github.com/milo526/homebridge-tuya-web/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/milo526/homebridge-tuya-web)](https://github.com/milo526/homebridge-tuya-web/pulls)

</span>

## Overview

Hoobs and Homebridge plugin for Tuya devices using a cloud Tuya Web Api.

This plugin is based on the Home Assistant Tuya integration that implements a special Tuya Home Assistant API.

See [Home Assistant Tuya integration](https://www.home-assistant.io/components/tuya/) and [Tuyaha python library](https://github.com/PaulAnnekov/tuyaha).

## Features

This plugin implements the following features:

- Controlling Tuya Wi-Fi enabled devices from within HomeKit enabled iOS Apps.
- Uses simple and lightweight Cloud Web API to control and get state update from Tuya devices. You will need a stable internet connection to control the devices.
- Device State Caching. State of devices is cached in memory, every time a HomeKit app request status updates from the devices this results in a very fast and responsive response. There can be a latency in updates when a device is controlled from an App/Hub/Controller other than HomeKit, e.g. from the Tuya Android/iOS App.

## Installation

```
npm i -g @milo526/homebridge-tuya-web
```

## Support

Please notice that there is no official support for this plugin.  
If you have a question, please [start a discussion](https://github.com/milo526/homebridge-tuya-web/discussions/new).  
If you would like to report a bug, please [open an issue](https://github.com/milo526/homebridge-tuya-web/issues/new/choose).

You can also get community help in the [Homebridge Discord Server](https://discord.gg/kqNCe2D) or on the [Homebridge Reddit](https://www.reddit.com/r/homebridge/).

<span style="text-align: center">

[![Homebridge Discord](https://discordapp.com/api/guilds/432663330281226270/widget.png?style=banner2)](https://discord.gg/kqNCe2D) [![Homebridge Reddit](https://raw.githubusercontent.com/homebridge/homebridge/master/.github/homebridge-reddit.svg?sanitize=true)](https://www.reddit.com/r/homebridge/)

</span>

# Configuration

> :check: The preferred and always up-to-date way to configure this plugin is through the config UI.  
> For details check [their documentation](https://github.com/oznu/homebridge-config-ui-x#readme).

```json
{
  "platform": "TuyaWebPlatform",
  "name": "TuyaWebPlatform",
  "options": {
    "username": "xxxx@gmail.com",
    "password": "xxxxxxxxxx",
    "countryCode": "xx",
    "platform": "tuya"
  }
}
```

The `options` has these properties:

- `username` Required. The username for the account that is registered in the Android/iOS App. _Due to a bug in the API the `username` can't contain dots_.
- `password` Required. The password for the account that is registered in the Android/iOS App.
- `countryCode` Required. Your account [country code](https://www.countrycode.org/), e.g., 1 for the USA or 86 for China.
- `platform` Optional. The App where you registered your account. `tuya` for Tuya Smart, `smart_life` for Smart Life, `jinvoo_smart` for Jinvoo Smart. Defaults to `tuya`. Also see _Platform_ section, below.
- `pollingInterval` Optional. Defaults to empty, which entails no polling. The frequency in **seconds** that the plugin polls the cloud to get device updates. When you exclusively control the devices through the plugin, you can set this to a low frequency (high interval number, e.g. 1800 = 30 minutes).

> :warning: Sign-in with Apple, Google, Facebook or any other provider is **not** supported and, due to limitations, will probably never be supported :warning:  
> Please make sure your account is created using a plain old username and password combination.

All option outlines below are optional, they are useful to provide finer control on the working of the plugin.

## Overruling Device Types

It is possible to override values from the default. As of now, only overruling device types is possible. See example configuration below.

```json
{
  "platform": "TuyaWebPlatform",
  "name": "TuyaWebPlatform",
  "options": {},
  "defaults": [
    {
      "id": "<device name or id>",
      "device_type": "<desired device type>"
    }
  ]
}
```

The `defaults` has these properties:

- `id` The name or ID for the device that is registered in the Android/iOS App. When matching on ID, please provide the `Tuya ID` as shown during plugin boot.
- `device_type` The `device_type` to be overruled. This can be useful for dimmers that are reported as `light` by the Tuya API and don't support hue and saturation, or for outlets that are reported as `switch`.

> Note: After overriding the device type, it might appear duplicated in both HomeBridge (Accessories Tab) and the Home App. To solve this issue, go to the Homebridge settings (top right corner) and remove the device using the `Remove Single Cached Accessory` option.

## Configure Devices

Some devices allow for extra configuration.  
The easiest option is to do this through [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x#homebridge-config-ui-x).  
In the plugin settings, go to "Device Settings" and click on "Add Device Settings".  
Add the device ID (or name) and select the device type.  
If the given device type allows overwriting settings, the options will appear below.

### Thermostat/Climate

These devices can have a minimum- and maximum temperature, as well as a temperature factor.

The minimum and maximum values must be entered as degrees Celsius with half degree increments; i.e. `-16`, `5`, `23`, `32.5`.  
This will influence the minimum and maximum temperature that you will be able to set the thermostat at in HomeKit.

The temperature factor can be used to influence the shown temperature. If HomeKit is showing an extremely high temperature, please try setting this value to `0.1`.
This will change the shown value from i.e. `220` to `220 * 0.1 = 22`.
The value entered here must be a positive decimal value i.e. `0.1`, `1`, `2.5`.

If desired, you can overwrite these devices to the temperature sensor. This will only report the current temperature and not allow you to change the temperature.

## Hiding devices

There are some valid reasons why you might not want to expose certain devices to HomeKit. You might for example have another plugin active which also exposes certain Tuya devices, adding these devices to this list will prevent them from showing up multiple times.

```json
{
  "platform": "TuyaWebPlatform",
  "name": "TuyaWebPlatform",
  "options": {},
  "hiddenAccessories": ["<device name or id>"]
}
```

## Whitelisting scenes

To prevent an overload of scenes clogging up your HomeKit devices, scenes are by default not exposed to HomeKit. When you wish to add Tuya scenes to homekit, you will need to add them to the whitelist.

### Add all scenes to HomeKit

You can add all your tuya scenes to HomeKit by setting the `scenes` key to `true`.

```json
{
  "platform": "TuyaWebPlatform",
  "name": "TuyaWebPlatform",
  "options": {},
  "scenes": true
}
```

### Add specific scenes to HomeKit

To add specific scenes to HomeKit, you can set the `scenes` key to true and set `scenesWhitelist` to an array in which you define either the names or IDs of the scenes that you'd wish to expose.

```json
{
  "platform": "TuyaWebPlatform",
  "name": "TuyaWebPlatform",
  "options": {},
  "scenes": true,
  "scenesWhitelist": ["Scene-id", "Scene-name"]
}
```

### Add no scenes to HomeKit

To explicitly disable scene support, set the `scenes` key to `false`.

# Supported Device Types

There is currently support for the following device types within this plugin:

- **Climate** - The plugin allows reading and setting the desired temperature for certain Tuya thermostats.
- **Cover** - The plugin allows opening and closing window coverings. If preferred, the device type can be set to `garage` to expose the cover device as a garage door.
- **Fan** - The platform supports most kinds of Tuya fans. This is partly implemented and only currently supports controlling the on/off state and speed control. The plugin lacks support for oscillation due to a Tuya limitation.
- **Light/Dimmer** - The platform supports most types of Tuya lights. This is partly implemented and only currently supports controlling the on/off state and the brightness. This can be used with a dimmer.
- **Scene** - Scenes support can be enabled in the config, this is disabled by default.
- **Switch/Outlet** - The platform supports switch and outlets/sockets.

# How to check whether the API this library uses can control your device?

- Copy [this script](https://github.com/milo526/homebridge-tuya-web/blob/master/tools/debug_discovery.py) to your PC with Python
  installed or to https://repl.it/
- Set/update config inside and run it
- Check if your devices are listed
  - If they are - open an issue and provide the output
  - If they are not - don't open an issue. Ask [Tuya support](mailto:support@tuya.com) to support your device in their
    `/homeassistant` API
- Remove the updated script, so your credentials won't leak

# Determining platform for branded devices

The Tuya cloud supports different branded platforms. If your devices came with a branded app, then it is likely that your username and password are not recognized by the Tuya platform. If the app that came with your devices is not for one of the supported platforms (_tuya_, _smart_life_ or _jinvoo_smart_) your best bet is to check which of the apps for the supported platforms recognizes your devices. Unregister your device from the branded app (so that they are "factory clean" again) and then try re-registering them in the app for one of the supported platforms.

The device checking script above can help you to debug this.

# Additional Resources

If you need more assistance regarding Plugin installation, please have a look at the following external resources:

- YouTube-Video: [Tuya Geräte über Homebridge-Web steuern - Einfach & Schnell ⏰](https://www.youtube.com/watch?v=6Jhon4lWmKc) (🇩🇪)
