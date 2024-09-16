---
name: Bug report
about: Create a report to help us improve
title: ''
labels: bug
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

**Describe the bug**
<!-- 
A clear and concise description of what the bug is. 
What behaviour do you observe, what do you see?
What do you expect to happen?
-->

**Steps To Reproduce**
<!--
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error
-->

**Plugin Version**
 <!--
 Go to your device in homekit, go to the device settings, scroll down to "Firmware"
 Should be in the form of "x.x.x"
 Are you not on the latest version? (Check https://github.com/milo526/homebridge-tuya-web/releases) 
 Please update to the latest version before you submit your bug report and see if the latest version already solved your problems.
 -->
 
 **Homebridge Config**
 <!--
 Please paste your config in the block below between the ```json and ```.
 Make sure to paste this as text.
 DON'T POST A SCREENSHOT OF YOUR CONFIG
 Posting an image instead of text makes my live unnecessarily hard.
 
 This should look something like
 
 ```json
 {
     "name": "TuyaWebPlatform",
     "options": {
         "username": REDACTED,
         "password": REDACTED,
         "countryCode": REDACTED,
         "platform": "tuya",
         "pollingInterval": 300
     },
     "defaults": [
         {
             "id": "Kitchen outlet",
             "device_type": "outlet"
         }
     ],
     "scenes": false,
     "platform": "TuyaWebPlatform"
 }
 ```
 
 you might have some extra settings or miss some settings here. Please make sure to include all the settings you have.
 For your own sanity ensure that you at least remove your password!
 -->
 
 ```json

```
 
 **Device Config**
 <!--
 Follow the steps as outlined under the heading "How to check whether the api this library uses can control your device"
 https://github.com/milo526/homebridge-tuya-web#how-to-check-whether-the-api-this-library-uses-can-control-your-device
 And include the full output here.
 Yes this is quite some work, but it is also very important, if you do not provide me this information;
 I can almost guarantee you that the first thing I do is request you to do this (or close your issue outright).
 You will probably not be helped before this information is provided, this is not because I like to be rude;
 this is because this information is essential for me to do almost anything with this plugin for you.
 -->
 
 **Additional Context**
 <!--
Add any other context about the problem here.
-->

<!--
Not following this template might result in outright closure of your issue!

As a closing remark,
thank you for opening a bug report. You are now helping this plugin improve!
-->
