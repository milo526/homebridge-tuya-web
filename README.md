<span style="text-align: center">

# Tuya Web

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![certified-by-hoobs](https://badgen.net/badge/hoobs/certified/yellow)](https://plugins.hoobs.org/plugin/@milo526/homebridge-tuya-web)

[![npm](https://img.shields.io/npm/v/@milo526/homebridge-tuya-web/latest?label=latest)](https://www.npmjs.com/package/@milo526/homebridge-tuya-web)
[![npm](https://img.shields.io/npm/dt/@milo526/homebridge-tuya-web)](https://www.npmjs.com/package/@milo526/homebridge-tuya-web)
[![GitHub release](https://img.shields.io/github/release/milo526/homebridge-tuya-web.svg)](https://github.com/milo526/homebridge-tuya-web/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</span>

## Overview

Homebridge plugin for Tuya devices using the Tuya Open API with QR code linking.

This plugin allows you to control your Tuya devices without needing a Tuya Developer account. You can simply link your Smart Life or Tuya app by scanning a QR code in the Homebridge Config UI.

## Features

- **Easy Setup**: No developer account required. Just scan a QR code.
- **Fast Discovery**: Automatically finds all supported devices in your Tuya account.
- **Responsive Control**: Uses Tuya's latest Open API for reliable and fast device control.
- **Broad Support**: Supports Lights, Switches, Outlets, Fans, and various Sensors.

## Installation

```bash
npm i -g @milo526/homebridge-tuya-web
```

## Configuration

> [!IMPORTANT]
> The preferred way to configure this plugin is through the **Homebridge Config UI X**.

1. Install the plugin.
2. Go to the **Plugins** tab in Homebridge Config UI.
3. Find **Tuya Web** and click **Settings**.
4. Select your **Region**.
5. Click the **"Link Tuya Account"** button.
6. A QR code will appear. Scan it using the **Smart Life** or **Tuya Smart** app on your phone (usually under "Profile" -> "Scan" icon at the top right).
7. Once authorized, click **Save** and restart Homebridge.

### Manual Configuration (Not Recommended)

```json
{
  "platform": "TuyaWebPlatform",
  "name": "Tuya",
  "region": "US",
  "pollingInterval": 60
}
```

## Supported Device Types

- **Lights**: On/Off, Brightness, Color Temperature, RGB Color.
- **Switches & Outlets**: On/Off control.
- **Fans**: On/Off and Speed control.
- **Sensors**: Motion, Contact, and Temperature sensors.

## Troubleshooting

If your devices are not appearing:
1. Ensure they are visible in the Tuya Smart / Smart Life app.
2. Check the Homebridge logs for any errors.
3. Try re-linking your account via the "Link Tuya Account" button.

## Support

If you have a question or find a bug, please [open an issue on GitHub](https://github.com/milo526/homebridge-tuya-web/issues).
