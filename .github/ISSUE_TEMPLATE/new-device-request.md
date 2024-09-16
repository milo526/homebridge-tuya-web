---
name: New device request
about: Request a new device added
title: "[NEW DEVICE] "
labels: ''
assignees: ''

---

<!--
Everything that is placed between these <! - - and - - > are considered comments and will not render. 
Make sure to place all your information outside of these notations, or I will not be able to read it!
-->

<!--
Please read this carefully, not reading and/or following this template carefully might result in your issue getting closed without a proper answer.
This template is however a guideline, if you have important or valuable information please add it!
If it is clear that a certain step is completely useless in your situation, feel free to leave it out.

Please note that there is only 1 main contributor to this project.
I might respond quickly, I might not.
I will try to help you to the best of my ability but my abilities are not endless.
I am human and to err is human, I make mistakes, if you think I closed your issue unfairly please considerately explain why you believe my judgement was wrong. I will probably reconsider.

I am not able to solve all your problems and entertain all your feature requests, part of this is because I don't actually own a lot of tuya devices.
A lot of the work I do is based on documentations and how some devices are supposed to work.
Who could have guessed, not all devices behave as they should.
-->

<!--
First of follow the steps outlined below, read them carefully, read the closely, follow the outlined steps
Failure to do so will waste both our times, these first steps do not outline requests of mine but hard requirements.
 
- Copy this script :https://github.com/milo526/homebridge-tuya-web/blob/master/tools/debug_discovery.py to your PC with Python installed or to https://repl.it/
- Set/update config inside and run it
- Check if your devices are listed
  - If they are - continue filling in this template (save the output of the script for now)
  - If they are not - don't open an issue. Ask [Tuya support](mailto:support@tuya.com) to support your device in their 
    `/homeassistant` API. I can not support your device. Tuya (which I am not affiliated with!) does not allow me to support your device.
    This is not something I can change.
- Remove the updated script, so your credentials won't leak
-->

**Device type**
<!--
What is the device you want to support?
Did you check other issues to see if somebody already requested support?
If there is already an issue please add your support to that issue instead of opening a new one.
If I already said no to other similar requests please consider if my reasoning is still valid, if it is, your issue will probably be closed with the same feedback.

If none of these apply to you please explain what type of device it is you wish to get support added for.
-->

**Device information**
<!--
Please add the output of the script you ran before here between ```json and ```

It should look something like:

```json
{   'header': {'code': 'SUCCESS', 'payloadVersion': 1},
    'payload': {   'devices': [   {   'data': {   'brightness': '255',
                                                  'color_temp': 5306,
                                                  'online': True,
                                                  'state': 'false'},
                                      'dev_type': 'light',
                                      'ha_type': 'light',
                                      'icon': 'https://images.tuyaeu.com/smart/icon/ay1541055fDGjj/156203178aa58b1.png',
                                      'id': '23650812dad236',
                                      'name': 'Filament'},
                                  {   'data': {   'online': False,
                                                  'speed': '1',
                                                  'speed_level': 3,
                                                  'state': 'false'},
                                      'dev_type': 'fan',
                                      'ha_type': 'fan',
                                      'icon': 'https://images.tuyaeu.com/smart/icon/15488626s7atba8_0.png',
                                      'id': '06003820997d65',
                                      'name': 'Ventilator'}],
                   'scenes': []}}
```

Also make clear what information belongs to the device you want to be supported (check where a familiar name is shown).
-->
```json

```
