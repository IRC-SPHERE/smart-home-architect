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
var RED = function() {

    var DEVICE_NODES = [
        "Camera",
        "EnvironmentalSensor",
        "ForwardingGateway",
        "HomeGateway",
        "Router",
        "VideoGateway",
        "WaterSensor",
        "WristbandSensor",
        //"CurrentCostSensor", // disabled to simplify the game
    ];

    var options;

    function resetOptions() {
        options = {
            testOption: false,
        };
    }
    resetOptions();

    function hideDropTarget() {
        $("#dropTarget").hide();
        RED.keyboard.remove(/* ESCAPE */ 27);
    }

    function save(force) {
        if (!force) {
            var invalid = false;
            var unknownNodes = [];
            RED.nodes.eachNode(function(node) {
                invalid = invalid || !node.valid;
                if (node.type === "unknown") {
                    if (unknownNodes.indexOf(node.name) == -1) {
                        unknownNodes.push(node.name);
                    }
                    invalid = true;
                }
            });
            if (!invalid) {
                invalid = !RED.nodes.links.reduce(function(acc, link) {
                    return acc && link.valid;
                }, true);
            }
            if (invalid) {
                if (unknownNodes.length > 0) {
                    $( "#node-dialog-confirm-save-config" ).hide();
                    $( "#node-dialog-confirm-save-unknown" ).show();
                    var list = "<li>"+unknownNodes.join("</li><li>")+"</li>";
                    $( "#node-dialog-confirm-save-unknown-list" ).html(list);
                } else {
                    $( "#node-dialog-confirm-save-config" ).show();
                    $( "#node-dialog-confirm-save-unknown" ).hide();
                }
                $( "#node-dialog-confirm-save" ).dialog("open");
                return;
            }
        }
        var nns = RED.nodes.createCompleteNodeSet(function() {return true});
        RED.view.dirty(false);

        if (!RED.settings.serverReadOnly) {
            // save on server
            $("#btn-icn-save").removeClass('icon-upload').addClass('spinner');

            $.ajax({
                url: "flows.json",
                type: "POST",
                data: JSON.stringify(nns),
                contentType: "application/json; charset=utf-8",
                mimeType: "application/json",
            }).done(function(data,textStatus,xhr) {
                RED.notify("Successfully saved on the server","success");
                RED.nodes.eachNode(function(node) {
                    if (node.changed) {
                        node.dirty = true;
                        node.changed = false;
                    }
                });
                // Once deployed, cannot undo back to a clean state
                RED.view.redraw();
            }).fail(function(xhr,textStatus,err) {
                RED.view.dirty(true);
                if (xhr.responseText) {
                    RED.notify("<strong>Error</strong>: "+xhr.responseText,"error");
                } else {
                    RED.notify("<strong>Error</strong>: no response from server","error");
                }
            }).always(function() {
                $("#btn-icn-save").removeClass('spinner').addClass('icon-upload');
            });
        }
        else {
            // save locally
            localStorage.setItem("currentFlow", JSON.stringify(nns));
            RED.notify("Successfully saved","success");
            RED.nodes.eachNode(function(node) {
                if (node.changed) {
                    node.dirty = true;
                    node.changed = false;
                }
            });
            RED.view.redraw();
        }
    }

    $('#btn-save').click(function() {
        save();
    });

    $('#btn-suggestion').click(function(){showSuggestion()});

    $('#btn-keyboard-shortcuts').click(function(){showHelp()});

    $( "#node-dialog-confirm-save" ).dialog({
        title: "Confirm save",
        modal: true,
        autoOpen: false,
        width: 530,
        height: 230,
        buttons: [
            {
                text: "Confirm save",
                click: function() {
                    save(true);
                    $( this ).dialog( "close" );
                }
            },
            {
                text: "Cancel",
                click: function() {
                    $( this ).dialog( "close" );
                }
            }
        ]
    });

    $( "#node-dialog-confirm-clear" ).dialog({
        title: "Clear status",
        modal: true,
        autoOpen: false,
        width: 530,
        height: 230,
        buttons: [
            {
                text: "Clear",
                click: function() {
                    if( $('#node-dialog-confirm-clear-devices').is(':visible')) {
                        RED.view.clearDevices();
                    } else {
                        RED.view.clearAchievements();
                    }
                    $( this ).dialog( "close" );
                }
            },
            {
                text: "Cancel",
                click: function() {
                    $( this ).dialog( "close" );
                }
            }
        ]
    });


    function loadSettings() {
        // no need to load; simply construct the json object here, locally
        RED.settings = {
	    serverReadOnly: true,
        };

        loadNodes();
    }

    function loadNodes() {
        // load the html files for each
        $.each(DEVICE_NODES, function(n) {
            var nodeType = DEVICE_NODES[n];
            RED.nodes.expectType(nodeType);
            $( "body" ).append('<div id="node' + nodeType + '"></div>');
            $( "#node" + nodeType ).load("nodes/" + nodeType + ".html");
        });
    }

    function loadFlows(loadLocal) {
        // all nodes should be loaded at this point
        $(".palette-spinner").hide();
        $(".palette-scroll").show();
        $("#palette-search").show();

        if (RED.settings.serverReadOnly && loadLocal === undefined) {
            var localFlow = localStorage.getItem("currentFlow");
            loadLocal = localFlow ? true : false; 
        }
        if (loadLocal) {
            // get from local storage
            RED.nodes.importNodes(localStorage.getItem("currentFlow") || "");
            RED.view.dirty(false);
            RED.view.redraw();
            RED.game.load();
        }
        else {
            // get from server
            var url = "flows.json";
            var qs = window.location.href.slice(window.location.href.indexOf('?') + 1);
            var flow = window.GetQueryString(qs)["flow"];
            if (flow) {
                url = flow;
            }
            $.ajax({
                url : url,
                dataType: "json",
                contentType: "application/json; charset=utf-8",
                mimeType: "application/json",
            }).done(function(nodes) {
                RED.nodes.importNodes(nodes);
                RED.view.dirty(false);
                RED.view.redraw();
                RED.game.load();
            }).fail(function(nodes) {
                RED.notify("Failed to load flows file", "error");
            });
        }
    }

    function showHelp() {
        var dialog = $('#node-help');

        //$("#node-help").draggable({
        //        handle: ".modal-header"
        //});

        dialog.on('show',function() {
            RED.keyboard.disable();
        });
        dialog.on('hidden',function() {
            RED.keyboard.enable();
        });

        dialog.modal();
    }

    function showSuggestion() {
        var dialog = $('#node-dialog-suggestion');
        var o = RED.suggestions.get();
        // if (s.length <= 80) {
        //   $( "#suggestion-text-container" ).css("text-align", "center");
        // } else {
        //   $( "#suggestion-text-container" ).css("text-align", "justify");
        // }
        var text;
        if (o.type === "Problem") {
            text = "<strong>Problem: </strong>" + o.text + "!";
        } else {
            text = o.text + ".";
        }
        $('#node-suggestion-text').html(text);
        dialog.modal();
    }


    $(function() {
        RED.keyboard.add(/* ? */ 191,{shift:true},function(){showHelp();d3.event.preventDefault();});

        loadSettings();
    });

    return {
        loadFlows : loadFlows,
        importOptions: function(globalOptions) {
            for (var n in globalOptions.global) {
                options[n] = globalOptions.global[n];
            }
        },
        exportOptions: function(globalOptions) {
            globalOptions.global = options;
        },
        resetOptions: resetOptions,
        getOptions: function() { return options }
    };
}();
