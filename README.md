# homebridge-tuya-web

Homebridge plugin for Tuya devices using a cloud Tuya Web Api.

**FORK support for "Scene" switch**

This Homebridge plugin is based on the Home Assistent Tuya integration that implements a special Tuya Home Assistant API.

See [Home Assistant Tuya integration](https://www.home-assistant.io/components/tuya/) and [Tuyaha python library](https://github.com/PaulAnnekov/tuyaha).

## Features

This Homebridge Plugin implements the following features:

- Controlling Tuya WIFI enabled devices form within HomeKit enabled iOS Apps.
- Uses simple and lightweight Cloud Web API to control and get state update from Tuya devices. You will need a stable internet connection to control the devices and get frequent state updates.
- Device State Caching. State of devices is cached in memory, every time a HomeKit app request status updates from the devices this results in a very fast and responsive response. State cache is updated every 10 seconds and when controled from a HomeKit app. There can be a latancy in updates when a device is controled form an App/Hub/Controller other than HomeKit, e.g. from the Tuya Android/iOS App.

## Installation

```
npm i fratton/homebridge-tuya-web -g
```

## Basic config.json

```javascript
{
  "platform": "TuyaWebPlatform",
  "name": "TuyaWebPlatform",
  "options":
    {
      "username": "xxxx@gmail.com",
      "password": "xxxxxxxxxx",
      "countryCode": "xx",
      "platform": "smart_life",
      "pollingInterval": 10
    }
}
```

The `options` has these properties:

- `username`: Required. The username for the account that is registered in the Android/iOS App.
- `password`: Required. The password for the account that is registered in the Android/iOS App.
- `countryCode`: Required. Your account [country code](https://www.countrycode.org/), e.g., 1 for USA or 86 for China.
- `plaform`: The App where your account is registered. `tuya` for Tuya Smart, `smart_life` for Smart Life, `jinvoo_smart` for Jinvoo Smart. Defaults to `tuya`.
- `pollingInterval`: Optional. The frequency in **seconds** that the plugin polls the cloud to get device updates. When the devices are only controlled through Homebridge, you can set this to a low frequency (high interval nummer, e.g. 180 = 3 minutes). Defaults to 10.

## Overrule / default values

As of version 0.1.6 it is possible to override or set values to default. As of now only overruling device type is posible. See configuration below.

```javascript
{
  "platform": "TuyaWebPlatform"
  "name": "TuyaWebPlatform",
  "options":
    {
      ...
    },
  "defaults": [
    {
      "id": "<id>",
      "device_type": "<device_type>"
    }
  ]
}
```

The `defaults` has these properties:

- `id`: Required. The id for the device that is registered in the Android/iOS App.
- `device_type`: Optional. The device_type to be overruled. For now only device type `dimmer` is supported. This can be usefull for dimmers that are reported as `light` by the Tuya API and don't support hue and saturation. 

## Supported device types

There is currently support for the following device types within this Homebridge plugin:

- **Switch/Outlet** - The platform supports switch and outlets/sockets.
- **Light/Dimmer** - The platform supports most kinds of Tuya light. Partly implemented, now only supports controlling on/off and brightness. This can be used with a dimmer.
- **Fan** - The platform support most kinds of Tuya Fans. Partly implemented, on/off and speed control work, oscillation is not implemented due to lack of support in the Tuya Homeassistant API. 
- **Scene** - Support for simple switch 'scene' 

The used Web API also supports these devices, but are not implemented yet in the plugin.

- **Climate** - Not yet supported.
- **Cover** - Not yet supported.

## TODO

These features are on my wishlist and need to be implemented:

- Implement devices that are not supported yet.
- Add option to enable/disable state caching.
- Add option to change polling frequency to user defined value (default is now 10 seconds).

## Unit tests

The source code also has some unit tests to test API calls. Run the following command to run the unit tests.

```
 mocha test/tuyawebapi_test.js
```

## Version history

##### Version 0.1.10 - 2020-06-15

- Add config panel
- Remove long error API

##### Version 0.1.8 - 2020-06-13

Add support for scene switch
