# homebridge-tuya-web
This Homebridge plugin is based on the Home Assistant Tuya integration that implements a special Tuya Home Assistant API.
See [Home Assistant Tuya integration](https://www.home-assistant.io/components/tuya/) and [Tuyaha python library](https://github.com/PaulAnnekov/tuyaha).
## Features
This Homebridge Plugin implements the following features:
- Controlling Tuya/Smart-Life Wi-Fi enabled devices from within HomeKit enabled iOS Apps.
- Uses a simple and lightweight API to control and get state updates for your devices. You will need a stable internet connection to control the devices and get frequent updates.
- Device State Caching. The state of your devices is cached in Homebridge. Every time HomeKit requests a status update for a device, the response will be very fast. The cache is updated every ten seconds (by default - can be changed) and when requested by a HomeKit app. There can be a small latency in updates when a device is controlled from an app/hub/controller other than HomeKit, e.g. the Tuya/Smart-Life Android/iOS App.
## Installation
```
sudo npm i @milo526/homebridge-tuya-web -g
```
## Configuration
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
- `countryCode`: Required. Your account [country code](https://www.countrycode.org/), e.g, 1 for USA or 86 for China.
- `platform`: The app where your account is registered. `tuya` for Tuya Smart, `smart_life` for Smart Life, `jinvoo_smart` for Jinvoo Smart. Defaults is `tuya`.
- `pollingInterval`: Optional. The frequency in **seconds** that the plugin polls the cloud to get device updates. When your devices are only controlled through HomeKit/Homebridge, you can set this to a low frequency (high interval number, e.g. 180 = 3 minutes). Defaults to 10 seconds.

## Overruling Device Types

As of version 0.1.6 it is possible to override values from the default. As of now, only overruling device types is possible. See example configuration below.

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

- `id`: Required. The ID for the device that is registered in the Android/iOS App.
- `device_type`: Optional. The device type to be overruled. For now only device type `dimmer` is supported. This can be useful for dimmers that are reported as `light` by the API and don't support hue and saturation. 

## Supported Device Types

There is currently support for the following device types within this Homebridge plugin:

- **Switch/Outlet** - The platform supports switch and outlets/sockets.
- **Light/Dimmer** - The platform supports most types of Tuya lights. This is partly implemented and only currently supports controlling the on/off state and the brightness. This can be used with a dimmer.
- **Fan** - The platform supports most kinds of Tuya fans. This is partly implemented and only currently supports controlling the on/off state and speed control. Oscillation is not implemented due to lack of support in the Tuya API. 

The Web API also supports these devices, but are not implemented yet in the plugin:

- **Climate** - Not yet supported.
- **Cover** - Not yet supported.
- **Scene** - Not supported. To be discussed.

## TODO

These features are on my wishlist to be implemented:

- Adding device types that are not supported yet.
- Add option to enable/disable state caching.

## Version history

##### Version 0.3.0 - 2020-06-17

* Partial fix for a bug that was causing Homebridge to restart (issue #4)

##### Version 0.1.7 - 2019-08-18

* Fixed not correct updating after reboot of Homebridge.

##### Version 0.1.6 - 2019-08-18

* Added light accessory (made by niksauer, thanks!!)
* Added overruling device type in config. Some dimmers are reported by Tuya API as `lights`. Dimmers don't have hue and saturation and therefore the device type has to be overruled to `dimmer`.

##### Version 0.1.5 - 2019-08-18

* Fixed issue #17 - Outlets and switches not turning off in Home app when turned off with other app.

##### Version 0.1.4 - 2019-08-09

* Switch to regional Tuya Web API server after authentication was successful (EU / China / USA).
