/**
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
RED.game = function() {

    var LAYOUT_FILE = "sphere-house-layout.json"

    var mainLoopPeriodMs = 1000;

    var mainLoopTimerID = null;

    var counter = 0;

    var isStarted = false;

    // info about all room segments
    var roomSegments = {};
    // the set of all room names (there can be multiple segments in a room)
    var roomNames = [];

    var coveragePercentages = {
        environmental : 0,
        wearable : 0,
        video : 0,
    };

    function assignRooms(node) {
        node.rooms = [];
        node.roomSegments = [];

        if (node._def.mobile) {
            // do not need to assign rooms
            return;
        }

        var extra = RED.options.getOption("roomBoundary");

        for (var rn in roomSegments) {
            var room  = roomSegments[rn];
            var x1 = room.x1 - extra;
            var y1 = room.y1 - extra;
            var x2 = room.x2 + extra;
            var y2 = room.y2 + extra;
            if (node.x >= x1 && node.y >= y1
                && node.x <= x2 && node.y <= y2) {
                node.rooms.push(room.room);
                node.roomSegments.push(room.roomSegment);
            }
        }
    }

    // Start from the home gateways and work backwards, using the BFS algorithm
    function recalculateReachability()
    {
        var queue = [];
        RED.nodes.eachNode(function (node) {
            node.isReachable = false;
            if (node._def.isHomeGateway) {
                queue.push(node);
            }
        });
        var links = RED.nodes.links;
        while (queue.length) {
            var node = queue.shift();
            node.isReachable = true;
            // add all nodes linking to this one as target, and haven't been seen yet
            var connectedLinks = links.filter(function(l) {
                // Normally pick up only nodes that input data in the current one;
                // but allow the information to flow both ways between SHG and whatever they're connected to,
                //return l.target === node || (node._def.isHomeGateway && l.source === node);

                // Changed to always allow the data to flow in both directions:
                // just in case requiring the difference between input and output links is too confusing.
                return l.target === node || l.source === node;
            });

            connectedLinks.forEach(function (l) {
                var other = (node === l.target ? l.source : l.target);
                if (other.isReachable === false) {
                    // add this new node to the queue
                    queue.push(other);
                }
            });
        }

        // also assign room(s) for each node: can be multiple if on the border!
        RED.nodes.eachNode(function (node) {
            assignRooms(node);
        });
    }

    function checkAchievement(a) {
        // evaluate all achievements: some of them will update state
        if (a.predicate()) {
            if (!RED.achievements.isDone(a.name)) {
                // store the state of this achievement
                RED.achievements.setDone(a.name);
                // show the dialog
                showAchievement(a);
            }
        } else {
            //console.log(a.name + " is NOT satisfied!");
        }
    }

    function showAchievement(a, isExisting) {
        var dialog = $('#node-dialog-achievement');
        if (a.explanation.length <= 80) {
            $( "#achievement-text-container" ).css("text-align", "center");
        } else {
            $( "#achievement-text-container" ).css("text-align", "justify");
        }
        $('#node-achievement-label').text(isExisting ? a.name : "New achievement: " + a.name);
        if (isExisting) {
            $('#achievement-text-congratulations').hide();
        } else {
            $('#achievement-text-congratulations').show();
        }
        $('#node-achievement-text').html(a.explanation + ".");
        dialog.modal();
    }

    function showAchievementByName(name, isExisting) {
        var a = RED.achievements.findByName(name);
        if (a) {
            showAchievement(a, isExisting);
        }
    }

    function redrawProgress() {
        //console.log("progress: " + JSON.stringify(coveragePercentages));
        
        $( "#progressbar-environmental > span").css("width", coveragePercentages.environmental + "%");
        $( "#progressbar-video > span").css("width", coveragePercentages.video + "%");
        $( "#progressbar-wearable > span").css("width", coveragePercentages.wearable + "%");

        $( "#progressbar-environmental").prop("data-label", coveragePercentages.environmental + "%");
        $( "#progressbar-video").prop("data-label", coveragePercentages.video + "%");
        $( "#progressbar-wearable").prop("data-label", coveragePercentages.wearable + "%");

        $( "#progressbar-environmental").prop("title", "Environmental sensing coverage: " + coveragePercentages.environmental + "%");
        $( "#progressbar-video").prop("title", "Video sensing coverage: " + coveragePercentages.video + "%");
        $( "#progressbar-wearable").prop("title", "Wearable sensing coverage: " + coveragePercentages.wearable + "%");
    }

    function mainLoop() {
        if (mainLoopTimerID) {
            clearTimeout(mainLoopTimerID);
            mainLoopTimerID = null;
        }

        recalculateReachability();

        // since a new achievement may lead to opening a modal dialog,
        // do not check them if a dialog is open for some other reason
        if (!$( '#dialog' ).dialog('isOpen')) {
            RED.achievements.get().forEach(checkAchievement);
        }

        redrawProgress();

        counter++;
        mainLoopTimerID = setTimeout(mainLoop, mainLoopPeriodMs);
    }

    function start() {
        console.log("starting the game...");

        // show the intro the first time this is played
        var hasShownIntro = localStorage.getItem("hasShownIntro") || "";
        if (!hasShownIntro) {
            localStorage.setItem("hasShownIntro", "true");
            RED.view.showIntro();
        }

        // start the main loop
        mainLoop();

        isStarted = true;

        // show a default suggestion in the sidebar
        RED.sidebar.info.clear();
    }

    function initRooms(layout) {
        console.log("initializing rooms...");

        // parse the reply data
        //layout = JSON.parse(layout);

        roomSegments = {};
        roomNames = [];

        layout.forEach(function (description) {
            roomSegments[description.roomSegment] = description;
            if (roomNames.indexOf(description.room) === -1) {
                roomNames.push(description.room);
            }
        });

        recalculateReachability();
    }

    function load() {
        console.log("loading the game...");

        // load layout
        var url = "library/layouts/" + LAYOUT_FILE;
        $.ajax({
            dataType: "json",
            mimeType: "application/json; charset=utf-8",
            url: url
        }).done(function(reply) {
            initRooms(reply);
            start();
        }).error(function(reply) {
            RED.notify("<strong>Error</strong> while loading house layout: " + JSON.stringify(reply), "error");
        });
    }

    return {
        load : load,
        getRoomNames : function () { return roomNames },
        setCoverage : function (t, x) { coveragePercentages[t] = x },
        getIsStarted : function () { return isStarted },
        showAchievementByName : showAchievementByName,
    };

}();
