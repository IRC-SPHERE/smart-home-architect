/**
 * Copyright 2013 IBM Corp.
 * Copyright 2018 University of Bristol
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
"use strict";
RED.options = function() {

    var options = {
        // 8 SPES-2: 320
        // 5 SPG-2: 200 (total 520)
        // 1-4 SPW-2: 50-200 (total 570-720)
        // 4 NUC: 480 (total 1050-1200)
        // 3 cameras: 240 (total 1290-1440)
        // 1 water sensor: 60 (total 1350-1500)
        startingCredits: 1500,

        // in pixels
        roomBoundary : 30,

        distanceMetersToPixels : 50,
    };

    var allProtocols = {
        "TSCH" :  {
            nm: "TSCH",
            name : "Time Slotted Channel Hopping (TSCH)",
            color: "#388e3c",
            range : 10 * options.distanceMetersToPixels,
            mode: "wireless",
            description: "TSCH is a network protocol for low-power wireless networks.<br/><br/>TSCH is widely used in industrial applications due to its higher reliability over competing wireless standards. It offers longer range and higher practical throughput than BLE version 4, but BLE 5 can be optimized to be either faster or with longer range. TSCH uses 2.4 GHz frequency band, and hops over multiple frequencies. It can achieve reliable wireless links even in home environment with signal fading and interference from other wireless devices."
        },
        "BLE" : {
            nm: "BLE",
            name : "Bluetooth Low Energy (BLE)",
            color: "#bf360c",
            range : 7 * options.distanceMetersToPixels,
            mode: "wireless",
            description: "Bluetooth Low Energy (BLE) is a network protocol for low-power wireless networks.<br/><br/>BLE is widely used in consumer electronics, such as smartphones and smartwatches. BLE uses 2.4 GHz frequency band, and applies adaptive frequency hopping in order to survive interference from other 2.4 GHz wireless  devices. The current version of SPHERE uses BLE version 4."
        },
        "USB" : {
            nm: "USB",
            name : "USB cable",
            color: "#666",
            // XXX: in reality this is 5 meters, but set to 3 to make the
            // devices seem to be more physically co-located
            range : 3 * options.distanceMetersToPixels,
            mode: "wired",
            description: "USB cables are widely used for short term wired connections.<br/><br/>Longer USB cables (up to 5 meters) allow better flexibility as where to put the connected device, but they are also much more likely to create a mess. In this game, the cables are kept short."
        },
        "433 MHz" : {
            nm: "433 MHz",
            name : "433 MHz wireless",
            color: "#dddddd",
            mode: "wireless",
            range : 20 * options.distanceMetersToPixels,
            description: ""
        },
        "PLC" : {
            nm: "PLC",
            name : "Power Line Comunications (PLC)",
            color: "#dddddd",
            mode: "wired",
            range : 10 * options.distanceMetersToPixels, // TODO: what to use here?
            description: ""
        },
        "WiFi" : {
            nm: "WiFi",
            name : "WiFi (5 GHz)",
            color: "#ffa043",
            mode: "wireless",
            // XXX: should be shorter to force using PLC?
            range : 15 * options.distanceMetersToPixels, //8 * distanceMetersToPixels,
            description: "WiFi is technology for wireless local area networking. It is based on a family of standards for short range wireless communication (IEEE 802.11).<br/><br/>The SPHERE systems use IEEE 802.11ac, a high-throughput, high-bandwidth variety of WiFi. The SPHERE's WiFi operates in the 5 GHz frequency band, thus does not interfere with most of home consumer devices which use the 2.4 GHz frequency band. It also does not interfere with SPHERE's TSCH or BLE, as these protocols also operate in 2.4 GHz."
        },
        "3G" : {
            nm: "3G",
            name : "3G (cellular connection)",
            color: "#ffa043",
            mode: "wireless",
            range : 100 * options.distanceMetersToPixels,
            description: "3G/4G cellular connection.<br/><br/>No health-related data is sent over the cellular connection in SPHERE, just the system monitoring data to make sure that it's still working and diagnose problems remotely."
        },
    };

    function getOption(name) {
        return options[name];
    }

    return {
        getProtocols: function () {
            var r = [];
            for (var p in allProtocols) {
                r.push(allProtocols[p]);
            }
            return r;
        },
        getProtocolByName: function (nm) {
            return allProtocols[nm];
        },
        getOption : getOption
    }
}();
