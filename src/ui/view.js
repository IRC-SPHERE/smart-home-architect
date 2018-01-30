/**
 * Copyright 2013, 2014 IBM Corp.
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
RED.view = function() {

    // XXX: match the SPHERE house picture size.
    // This is to avoid scaling issues with Chrome.
    var space_width = 1400,
        space_height = 1400,
        lineCurveScale = 0.75;

    var node_dimensions = [];
    
    var touchLongPressTimeout = 1000,
        startTouchDistance = 0,
        startTouchCenter = [],
        moveTouchCenter = [],
        touchStartTime = 0;

    var active_ws = 0;

    var clearOnImport = false,
        nodeGeneration = 0;

    var selected_link = null,
        mousedown_link = null,
        mousedown_node = null,
        mousedown_port_type = null,
        mousedown_port_index = 0,
        mouseup_node = null,
        mouse_offset = [0,0],
        mouse_position = null,
        mouse_mode = 0,
        moving_set = [],
        dirty = false,
        lasso = null,
        showStatus = false,
        nodeClickTime = 0,
        nodeClickElapsed = 0,
        linkClickTime = 0,
        linkClickElapsed = 0,
        redrawAllNodes = false,
        redrawBackground = true;

    var clipboard = "";

    var status_colours = {
        "red":    "#c00",
        "green":  "#5a8",
        "yellow": "#F9DF31",
        "blue":   "#53A3F3",
        "grey":   "#d3d3d3"
    }

    var options;
    function resetOptions() {
        options = {
            backgroundImage: {
                // XXX: this does not belong here!
                "url": "library/backgrounds/sphere-house-s.png",
                "w": 1400,
                "h": 1400,
            },
            taskWidth: 120,
            taskHeight: 30,
            linkWidth: 150
        };
    }
    resetOptions();

    var workspaceStatus = {};

    function getWorkspaceStatus(id) {
        if (!workspaceStatus.hasOwnProperty(id)) {
            workspaceStatus[id] = {scaleFactor: 1};
        }
        return workspaceStatus[id];
    }
    function setWorkspaceStatus(id, status) {
        var s = getWorkspaceStatus(id);
        for (var k in status) {
            s[k] = status[k];
        }
    }

    var outer = d3.select("#chart")
        .append("svg:svg")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("version", "1.1")
        .attr("width", space_width)
        .attr("height", space_height)
        .attr("pointer-events", "all")
        .style("cursor","crosshair");

     var vis = outer
        .append('svg:g')
        .on("dblclick.zoom", null)
        .append('svg:g')
        .on("mousemove", canvasMouseMove)
        .on("mousedown", canvasMouseDown)
        .on("mouseup", canvasMouseUp)
        .on("mouseleave", canvasMouseLeave)
        .on("touchend", function() {
            clearTimeout(touchStartTime);
            touchStartTime = null;
            if  (RED.touch.radialMenu.active()) {
                return;
            }
            if (lasso) {
                outer_background.attr("fill","#fff");
            }
            canvasMouseUp.call(this);
        })
        .on("touchcancel", canvasMouseUp)
        .on("touchstart", function() {
            if (d3.event.touches.length>1) {
                clearTimeout(touchStartTime);
                touchStartTime = null;
                d3.event.preventDefault();
                var touch0 = d3.event.touches.item(0);
                var touch1 = d3.event.touches.item(1);
                var a = touch0['pageY']-touch1['pageY'];
                var b = touch0['pageX']-touch1['pageX'];
                var scaleFactor = getWorkspaceStatus(active_ws).scaleFactor;

                var offset = $("#chart").offset();
                var scrollPos = [$("#chart").scrollLeft(),$("#chart").scrollTop()];
                startTouchCenter = [
                    (touch1['pageX']+(b/2)-offset.left+scrollPos[0])/scaleFactor,
                    (touch1['pageY']+(a/2)-offset.top+scrollPos[1])/scaleFactor
                ];
                moveTouchCenter = [
                    touch1['pageX']+(b/2),
                    touch1['pageY']+(a/2)
                ]
                startTouchDistance = Math.sqrt((a*a)+(b*b));
            } else {
                var obj = d3.select(document.body);
                var touch0 = d3.event.touches.item(0);
                var pos = [touch0.pageX,touch0.pageY];
                startTouchCenter = [touch0.pageX,touch0.pageY];
                startTouchDistance = 0;
                var point = d3.touches(this)[0];
                touchStartTime = setTimeout(function() {
                    touchStartTime = null;
                    showTouchMenu(obj,pos);
                    //lasso = vis.append('rect')
                    //    .attr("ox",point[0])
                    //    .attr("oy",point[1])
                    //    .attr("rx",2)
                    //    .attr("ry",2)
                    //    .attr("x",point[0])
                    //    .attr("y",point[1])
                    //    .attr("width",0)
                    //    .attr("height",0)
                    //    .attr("class","lasso");
                    //outer_background.attr("fill","#e3e3f3");
                },touchLongPressTimeout);
            }
        })
        .on("touchmove", function(){
                if (RED.touch.radialMenu.active()) {
                    d3.event.preventDefault();
                    return;
                }
                if (d3.event.touches.length<2) {
                    if (touchStartTime) {
                        var touch0 = d3.event.touches.item(0);
                        var dx = (touch0.pageX-startTouchCenter[0]);
                        var dy = (touch0.pageY-startTouchCenter[1]);
                        var d = Math.abs(dx*dx+dy*dy);
                        if (d > 64) {
                            clearTimeout(touchStartTime);
                            touchStartTime = null;
                        }
                    } else if (lasso) {
                        d3.event.preventDefault();
                    }
                    canvasMouseMove.call(this);
                } else {
                    var touch0 = d3.event.touches.item(0);
                    var touch1 = d3.event.touches.item(1);
                    var a = touch0['pageY']-touch1['pageY'];
                    var b = touch0['pageX']-touch1['pageX'];
                    var offset = $("#chart").offset();
                    var scrollPos = [$("#chart").scrollLeft(),$("#chart").scrollTop()];
                    var moveTouchDistance = Math.sqrt((a*a)+(b*b));
                    var touchCenter = [
                        touch1['pageX']+(b/2),
                        touch1['pageY']+(a/2)
                    ];

                    if (!isNaN(moveTouchDistance)) {
                        oldScaleFactor = scaleFactor;
                        scaleFactor = Math.min(2,Math.max(0.3, scaleFactor + (Math.floor(((moveTouchDistance*100)-(startTouchDistance*100)))/10000)));

                        var deltaTouchCenter = [                             // Try to pan whilst zooming - not 100%
                            startTouchCenter[0]*(scaleFactor-oldScaleFactor),//-(touchCenter[0]-moveTouchCenter[0]),
                            startTouchCenter[1]*(scaleFactor-oldScaleFactor) //-(touchCenter[1]-moveTouchCenter[1])
                        ];

                        startTouchDistance = moveTouchDistance;
                        moveTouchCenter = touchCenter;

                        $("#chart").scrollLeft(scrollPos[0]+deltaTouchCenter[0]);
                        $("#chart").scrollTop(scrollPos[1]+deltaTouchCenter[1]);
                        redraw();
                    }
                }
        });

    var defs = vis.append("defs");

    defs.append("pattern")
        .attr("id","tab_bg_pattern")
        .attr('width', space_width)
        .attr('height', space_height)
        .attr('patternUnits', 'userSpaceOnUse')
        .append("image")
            .attr("id","tab_bg_image")
            .attr("xlink:href","pw_maze_white.png")
            .attr('width', 60)
            .attr('height', 30)

    // create an arrow marker
    defs.append("svg:marker")
        .attr("id", "marker_arrow")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 8)
        .attr("refY", 3)
        .attr("markerUnits", "strokeWidth")
        .attr("markerWidth", 10)
        .attr("markerHeight", 10)
        .attr("orient", "auto")
        .append("svg:path")
        .attr("d","M 0 0 L 10 3 L 0 6 z");

    var outer_background = vis.append('svg:rect')
        .attr("id","background_rect")
        .attr('width', space_width)
        .attr('height', space_height)
        .attr('fill','#fff');

    var drag_line = vis.append("svg:path").attr("class", "drag_line");

    function shouldDisplayNode(node) {
        // is it a link?
        if (node.hasOwnProperty("source")) {
            node = node.source;
            if (node === null) return false;
        }
        return node.z === active_ws;
    }

    function nodeColor(d) {
        if (d.hasOwnProperty("template")) {
            var template = RED.nodes.node(d.template);
            if (template && template.hasOwnProperty("color")) {
                return template.color;
            }
        }
        if (d.color) {
            return d.color;
        }
        return d._def.color;
    }

    var workspace_tabs = RED.tabs.create({
        id: "workspace-tabs",
        onchange: function(tab) {
            if (tab.type == "subflow") {
                $("#workspace-toolbar").show();
            } else {
                $("#workspace-toolbar").hide();
            }
            var chart = $("#chart");
            if (active_ws != 0) {
                setWorkspaceStatus(active_ws, {
                    scrollPosLeft: chart.scrollLeft(),
                    scrollPosTop: chart.scrollTop()
                });
            }
            var scrollStartLeft = chart.scrollLeft();
            var scrollStartTop = chart.scrollTop();

            active_ws = tab.id;

            var status = getWorkspaceStatus(active_ws);
            chart.scrollLeft(status.scrollPosLeft);
            chart.scrollTop(status.scrollPosTop);

            var scrollDeltaLeft = chart.scrollLeft() - scrollStartLeft;
            var scrollDeltaTop = chart.scrollTop() - scrollStartTop;
            if (mouse_position != null) {
                mouse_position[0] += scrollDeltaLeft;
                mouse_position[1] += scrollDeltaTop;
            }

            clearSelection();
            RED.nodes.eachNode(function(n) {
                n.dirty = true;
            });
            RED.nodes.eachLink(function(n) {
                n.dirty = true;
            });
            redrawBackground = true;
            redraw();
        },
        ondblclick: function(tab) {
            showRenameWorkspaceDialog(tab.id);
        },
        onadd: function(tab) {
            var menuli = $("<li/>");
            var menuA = $("<a/>",{tabindex:"-1",href:"#"+tab.id}).appendTo(menuli);
            menuA.html(tab.label);
            menuA.on("click",function() {
                workspace_tabs.activateTab(tab.id);
            });

            $('#workspace-menu-list').append(menuli);

            if (workspace_tabs.count() <= 1) {
                $('#btn-workspace-delete').parent().addClass("disabled");
                $('#btn-dialog-workspace-delete').addClass("disabled");
                $('#btn-dialog-workspace-delete').prop("disabled", true);
            } else {
                $('#btn-workspace-delete').parent().removeClass("disabled");
                $('#btn-dialog-workspace-delete').removeClass("disabled");
                $('#btn-dialog-workspace-delete').prop("disabled", false);
            }
        },
        onremove: function(tab) {
            if (workspace_tabs.count() <= 1) {
                $('#btn-workspace-delete').parent().addClass("disabled");
                $('#btn-dialog-workspace-delete').addClass("disabled");
                $('#btn-dialog-workspace-delete').prop("disabled", true);
            } else {
                $('#btn-workspace-delete').parent().removeClass("disabled");
                $('#btn-dialog-workspace-delete').removeClass("disabled");
                $('#btn-dialog-workspace-delete').prop("disabled", false);
            }
            $('#workspace-menu-list a[href="#'+tab.id+'"]').parent().remove();

        }
    });

    var workspaceIndex = 0;

    function addWorkspace() {
        var tabId = getRandomID();
        do {
            workspaceIndex += 1;
        } while($("#workspace-tabs a[title='SPHERE house "+workspaceIndex+"']").size() != 0);

        var ws = {type:"tab",id:tabId,label:"SPHERE house "+workspaceIndex};
        RED.nodes.addWorkspace(ws);
        workspace_tabs.addTab(ws);
        workspace_tabs.activateTab(tabId);
        setDirty(true);
    }
    $('#btn-workspace-add-tab').on("click",addWorkspace);
    $('#btn-workspace-add').on("click",addWorkspace);
    $('#btn-workspace-edit').on("click",function() {
        showRenameWorkspaceDialog(active_ws);
    });
    $('#btn-workspace-delete').on("click",function() {
        deleteWorkspace(active_ws);
    });

    function deleteWorkspace(id) {
        var ws = RED.nodes.workspace(id);
        if (workspace_tabs.count() <= 1) {
            return;
        }
        $( "#node-dialog-delete-workspace" ).dialog('option','workspace',ws);
        $( "#node-dialog-delete-workspace-name" ).text(ws.label);
        $( "#node-dialog-delete-workspace" ).dialog('open');
    }

    function setSelectedLink(d) {
        if (selected_link) selected_link.selected = false;
        if (d) d.selected = true;
        selected_link = d;
    }

    function showSelected() {
        // if a link is selected
        if (selected_link) {
            RED.sidebar.info.refreshLink(selected_link);
            return;
        }
        // if there is a moving set
        var result = null;
        if (moving_set.length > 0) {
            result = moving_set[0].n;
        }
        else{
            // just pick any node that is marked as selected
            RED.nodes.eachNode(function(n) {
                if (n.z == active_ws) {
                    if (n.selected && result === null) {
                        result = n;
                    }
                }
            });
        }
        if (result) {
            RED.sidebar.info.refreshNode(result);
        }
    }

    function canvasMouseDown() {
        if (!mousedown_node && !mousedown_link) {
            setSelectedLink(null);
            updateSelection();
        }
        if (mouse_mode == 0) {
            if (lasso) {
                lasso.remove();
                lasso = null;
            }

            var point = d3.mouse(this);
            if (!touchStartTime) {
                lasso = vis.append('rect')
                    .attr("ox",point[0])
                    .attr("oy",point[1])
                    .attr("rx",2)
                    .attr("ry",2)
                    .attr("x",point[0])
                    .attr("y",point[1])
                    .attr("width",0)
                    .attr("height",0)
                    .attr("class","lasso");
                d3.event.preventDefault();
            }
        }
    }

    function checkLinkRanges() {
        var toRemove = [];

        RED.nodes.eachLink(function(link) {
            var p = RED.options.getProtocolByName(link.protocol);
            if (!p) {
                // ignore this invalid link
                return;
            }
            var distance = RED.nodes.getDistance(link.source, link.target);
            if (distance > p.range) {
                var linkName = "link from " + getValue(link.source._def.label, link.source)
                    + " to " + getValue(link.target._def.label, link.target);               
                RED.notify("Breaking " + linkName + ": out of range for the " + p.nm + " protocol"); //, "error");
                toRemove.push(link);
            }
        });

        toRemove.forEach(function(link) {RED.nodes.removeLink(link)});
    }

    function canvasMouseMove() {
        mouse_position = d3.touches(this)[0]||d3.mouse(this);

        // Prevent touch scrolling...
        //if (d3.touches(this)[0]) {
        //    d3.event.preventDefault();
        //}

        // TODO: auto scroll the container
        //var point = d3.mouse(this);
        //if (point[0]-container.scrollLeft < 30 && container.scrollLeft > 0) { container.scrollLeft -= 15; }
        //console.log(d3.mouse(this),container.offsetWidth,container.offsetHeight,container.scrollLeft,container.scrollTop);

        if (lasso) {
            var ox = parseInt(lasso.attr("ox"));
            var oy = parseInt(lasso.attr("oy"));
            var x = parseInt(lasso.attr("x"));
            var y = parseInt(lasso.attr("y"));
            var h, w;
            if (mouse_position[0] < ox) {
                x = mouse_position[0];
                w = ox-x;
            } else {
                w = mouse_position[0]-x;
            }
            if (mouse_position[1] < oy) {
                y = mouse_position[1];
                h = oy-y;
            } else {
                h = mouse_position[1]-y;
            }
            lasso
                .attr("x",x)
                .attr("y",y)
                .attr("width",w)
                .attr("height",h)
            ;
            return;
        }

        if (mouse_mode == RED.state.JOINING) {
            // update drag line
            drag_line.attr("class", "drag_line");
            var mousePos = mouse_position;
            var numOutputs = (mousedown_port_type == 0)?(mousedown_node.outputs || 1):1;
            var sourcePort = mousedown_port_index;

            var sc = (mousedown_port_type == 0)?1:-1;
            
            var x = mousedown_node.cx + sc*mousedown_node.w/2;
            var y = /* mousedown_node.cy */ + -((numOutputs-1)/2)*13 +13*sourcePort;

            var dx = mousePos[0]-(mousedown_node.x+x);
            var dy = mousePos[1]-(mousedown_node.y+y);
            var delta = Math.sqrt(dy*dy+dx*dx);
            var scale = lineCurveScale;
            var scaleY = 0;

            var node_width = +options.taskWidth;
            var node_height = +options.taskHeight;

            // force redrawing nodes, as port colors may change
            redrawAllNodes = true;

            if (delta < node_width) {
                scale = 0.75-0.75*((node_width-delta)/node_width);
            }
            if (dx*sc < 0) {
                scale += 2*(Math.min(5*node_width,Math.abs(dx))/(5*node_width));
                if (Math.abs(dy) < 3*node_height) {
                    scaleY = ((dy>0)?0.5:-0.5)*(((3*node_height)-Math.abs(dy))/(3*node_height))*(Math.min(node_width,Math.abs(dx))/(node_width)) ;
                }
            }

            drag_line.attr("d",
                "M "+(mousedown_node.x+sc*mousedown_node.w/2)+" "+(mousedown_node.y)+
                " C "+(mousedown_node.x+sc*(mousedown_node.w/2+node_width*scale))+" "+(mousedown_node.y+y+scaleY*node_height)+" "+
                (mousePos[0]-sc*(scale)*node_width)+" "+(mousePos[1]-scaleY*node_height)+" "+
                mousePos[0]+" "+mousePos[1]);
            d3.event.preventDefault();
        } else if (mouse_mode == RED.state.MOVING) {
            var m = mouse_position;
            var d = (mouse_offset[0]-m[0])*(mouse_offset[0]-m[0]) + (mouse_offset[1]-m[1])*(mouse_offset[1]-m[1]);
            if (d > 2) {
                mouse_mode = RED.state.MOVING_ACTIVE;
                nodeClickElapsed = 0;
            }
        } else if (mouse_mode == RED.state.MOVING_ACTIVE || mouse_mode == RED.state.IMPORT_DRAGGING) {
            var mousePos = mouse_position;
            var minX = 0;
            var minY = 0;
            for (var n = 0; n<moving_set.length; n++) {
                var node = moving_set[n];
                if (d3.event.shiftKey) {
                    node.n.ox = node.n.x;
                    node.n.oy = node.n.y;
                }
                node.n.x = mousePos[0]+node.dx;
                node.n.y = mousePos[1]+node.dy;
                node.n.dirty = true;
                minX = Math.min(node.n.x-node.n.w/2-5,minX);
                minY = Math.min(node.n.y-node.n.h/2-5,minY);
            }
            if (minX != 0 || minY != 0) {
                for (var n = 0; n<moving_set.length; n++) {
                    var node = moving_set[n];
                    node.n.x -= minX;
                    node.n.y -= minY;
                }
            }
            if (d3.event.shiftKey && moving_set.length > 0) {
                var gridOffset =  [0,0];
                var node = moving_set[0];
                gridOffset[0] = node.n.x-(20*Math.floor((node.n.x-node.n.w/2)/20)+node.n.w/2);
                gridOffset[1] = node.n.y-(20*Math.floor(node.n.y/20));
                if (gridOffset[0] != 0 || gridOffset[1] != 0) {
                    for (var n = 0; n<moving_set.length; n++) {
                        var node = moving_set[n];
                        node.n.x -= gridOffset[0];
                        node.n.y -= gridOffset[1];
                        if (node.n.x == node.n.ox && node.n.y == node.n.oy) {
                            node.dirty = false;
                        }
                    }
                }
            }
            if (moving_set.length == 1) {
                // recalculate rooms
                RED.sidebar.info.refreshNodeRooms(moving_set[0].n);
            }
            checkLinkRanges();
        }
        redraw();
    }

    function canvasMouseUp() {
        if (mousedown_node && mouse_mode == RED.state.JOINING) {
            drag_line.attr("class", "drag_line_hidden");
            redrawAllNodes = true;
        }
        if (lasso) {
            var x = parseInt(lasso.attr("x"));
            var y = parseInt(lasso.attr("y"));
            var x2 = x+parseInt(lasso.attr("width"));
            var y2 = y+parseInt(lasso.attr("height"));
            if (!d3.event.ctrlKey) {
                clearSelection();
            }
            RED.nodes.eachNode(function(n) {
                if (n.z == active_ws && !n.selected) {
                    n.selected = (n.x > x && n.x < x2 && n.y > y && n.y < y2);
                    if (n.selected) {
                        n.dirty = true;
                        moving_set.push({n:n});
                    }
                }
            });
            updateSelection();
            lasso.remove();
            lasso = null;
        } else if (mouse_mode == RED.state.DEFAULT && mousedown_link == null) {
            clearSelection();
            updateSelection();
        }
        if (mouse_mode == RED.state.MOVING_ACTIVE) {
            if (moving_set.length > 0) {
                var ns = [];
                for (var i in moving_set) {
                    ns.push({n:moving_set[i].n,ox:moving_set[i].ox,oy:moving_set[i].oy});
                }
            }
        }
        if (mouse_mode == RED.state.MOVING || mouse_mode == RED.state.MOVING_ACTIVE) {
            for (var i=0;i<moving_set.length;i++) {
                delete moving_set[i].ox;
                delete moving_set[i].oy;
            }
        }
        else if (mouse_mode == RED.state.IMPORT_DRAGGING) {
            RED.keyboard.remove(/* ESCAPE */ 27);
            setDirty(true);
        }
        redraw();
        // clear mouse event vars
        resetMouseVars();
    }

    $('#btn-zoom-out').click(function() {zoomOut();});
    $('#btn-zoom-zero').click(function() {zoomZero();});
    $('#btn-zoom-in').click(function() {zoomIn();});
    $("#chart").on('DOMMouseScroll mousewheel', function (evt) {
        if ( evt.altKey ) {
            evt.preventDefault();
            evt.stopPropagation();
            var move = -(evt.originalEvent.detail) || evt.originalEvent.wheelDelta;
            if (move <= 0) { zoomOut(); }
            else { zoomIn(); }
        }
    });
    $("#chart").droppable({
            accept:".palette_node",
            drop: function( event, ui ) {
                d3.event = event;

                var selected_tool = ui.draggable[0].type;
                var scaleFactor = getWorkspaceStatus(active_ws).scaleFactor;
                var x = ui.position.left - $("#chart").offset().left;
                var y = ui.position.top - $("#chart").offset().top;
                x += RED.nodes.NODE_WIDTH / 2;
                y += RED.nodes.NODE_HEIGHT / 2;
                x += this.scrollLeft;
                y += this.scrollTop;
                x /= scaleFactor;
                y /= scaleFactor;

                var nn = {
                    id:getRandomID(),
                    x:x,
                    y:y,
                    w:+options.taskWidth,
                    z:active_ws
                };

                // If the node is the bin region, don't do anything
                if (nodeInBinRegion(nn)) {
                    return;
                }

                nn.type = selected_tool;
                nn._def = RED.nodes.getType(nn.type);
                nn.outputs = nn._def.outputs;
                nn.inputs = nn._def.inputs;
                nn.changed = true;

                if (!RED.nodes.canAddNode(nn)) {
                    RED.notify("Cannot add this device: the credit limit would be exceeded!", "error");
                    return;
                }

                for (var d in nn._def.defaults) {
                    nn[d] = nn._def.defaults[d].value;
                }

                if (nn._def.onadd) {
                    nn._def.onadd.call(nn);
                }

                var node_height = +options.taskHeight;
                nn.h = Math.max(node_height,(nn.outputs||0) * 15);
                RED.nodes.addNode(nn);
                RED.editor.validateNode(nn);
                setDirty(true);
                // auto select dropped node - so info shows (if visible)
                clearSelection();
                nn.selected = true;
                moving_set.push({n:nn});
                updateSelection();
                redraw();

                if (nn._def.autoedit) {
                    RED.editor.edit(nn);
                }
            }
    });

    function canvasMouseLeave() {
        // Clear the info about the selected node or link;
        // this will helpfully show the next suggestion to the user.
        RED.sidebar.info.clear();
    }

    function zoomIn() {
        var status = getWorkspaceStatus(active_ws);
        if (status.scaleFactor < 2) {
            status.scaleFactor += 0.1;
            redraw();
        }
    }
    function zoomOut() {
        var status = getWorkspaceStatus(active_ws);
        if (status.scaleFactor > 0.3) {
            status.scaleFactor -= 0.1;
            redraw();
        }
    }
    function zoomZero() {
        getWorkspaceStatus(active_ws).scaleFactor = 1;
        redraw();
    }

    function selectAll() {
        RED.nodes.eachNode(function(n) {
            if (n.z == active_ws) {
                if (!n.selected) {
                    n.selected = true;
                    n.dirty = true;
                    moving_set.push({n:n});
                }
            }
        });
        setSelectedLink(null);
        updateSelection();
        redraw();
    }

    function clearSelection() {
        for (var i in moving_set) {
            var n = moving_set[i];
            n.n.dirty = true;
            n.n.selected = false;
        }
        moving_set = [];
        setSelectedLink(null);
    }

    function updateSelection() {
        if (moving_set.length == 0 && selected_link == null) {
            RED.keyboard.remove(/* backspace */ 8);
            RED.keyboard.remove(/* delete */ 46);
            RED.keyboard.remove(/* c */ 67);
            RED.keyboard.remove(/* x */ 88);
        } else {
            RED.keyboard.add(/* backspace */ 8,function(){deleteSelection();d3.event.preventDefault();});
            RED.keyboard.add(/* delete */ 46,function(){deleteSelection();d3.event.preventDefault();});
            RED.keyboard.add(/* c */ 67,{ctrl:true},function(){copySelection();d3.event.preventDefault();});
            RED.keyboard.add(/* x */ 88,{ctrl:true},function(){copySelection();deleteSelection();d3.event.preventDefault();});
        }
        if (moving_set.length == 0) {
            RED.keyboard.remove(/* up   */ 38);
            RED.keyboard.remove(/* down */ 40);
            RED.keyboard.remove(/* left */ 37);
            RED.keyboard.remove(/* right*/ 39);
        } else {
            RED.keyboard.add(/* up   */ 38, function() { d3.event.shiftKey?moveSelection(  0,-20):moveSelection( 0,-1);d3.event.preventDefault();},endKeyboardMove);
            RED.keyboard.add(/* down */ 40, function() { d3.event.shiftKey?moveSelection(  0, 20):moveSelection( 0, 1);d3.event.preventDefault();},endKeyboardMove);
            RED.keyboard.add(/* left */ 37, function() { d3.event.shiftKey?moveSelection(-20,  0):moveSelection(-1, 0);d3.event.preventDefault();},endKeyboardMove);
            RED.keyboard.add(/* right*/ 39, function() { d3.event.shiftKey?moveSelection( 20,  0):moveSelection( 1, 0);d3.event.preventDefault();},endKeyboardMove);
        }
        if (moving_set.length == 1) {
            RED.sidebar.info.refreshNode(moving_set[0].n);
        } else if (selected_link) {
            RED.sidebar.info.refreshLink(selected_link);
        } else {
            RED.sidebar.info.clear();
        }
    }
    function endKeyboardMove() {
        var ns = [];
        for (var i=0;i<moving_set.length;i++) {
            ns.push({n:moving_set[i].n,ox:moving_set[i].ox,oy:moving_set[i].oy});
            delete moving_set[i].ox;
            delete moving_set[i].oy;
        }
    }
    function moveSelection(dx,dy) {
        var minX = 0;
        var minY = 0;

        for (var i=0;i<moving_set.length;i++) {
            var node = moving_set[i];
            if (node.ox == null && node.oy == null) {
                node.ox = node.n.x;
                node.oy = node.n.y;
            }
            node.n.x += dx;
            node.n.y += dy;
            node.n.dirty = true;
            minX = Math.min(node.n.x-node.n.w/2-5,minX);
            minY = Math.min(node.n.y-node.n.h/2-5,minY);
        }

        if (minX != 0 || minY != 0) {
            for (var n = 0; n<moving_set.length; n++) {
                var node = moving_set[n];
                node.n.x -= minX;
                node.n.y -= minY;
            }
        }

        redraw();
    }
    function deleteSelection() {
        var removedNodes = [];
        var removedLinks = [];
        var startDirty = dirty;
        if (moving_set.length > 0) {
            for (var i in moving_set) {
                var node = moving_set[i].n;
                node.selected = false;
                if (node.x < 0) {node.x = 25};
                var rmlinks = RED.nodes.remove(node.id);
                removedNodes.push(node);
                removedLinks = removedLinks.concat(rmlinks);
            }
            moving_set = [];
            setDirty(true);
        }
        if (selected_link) {
            RED.nodes.removeLink(selected_link);
            removedLinks.push(selected_link);
            setDirty(true);
        }

        setSelectedLink(null);
        updateSelection();
        redraw();
    }

    function copySelection() {
        if (moving_set.length > 0) {
            var nns = [];
            for (var n in moving_set) {
                var node = moving_set[n].n;
                nns.push(RED.nodes.convertNode(node));
            }
            clipboard = JSON.stringify(nns);
            RED.notify(moving_set.length+" node"+(moving_set.length>1?"s":"")+" copied");
        }
    }

    function calculateTextStart(d, l) {
        var w = calculateNodeWidth(d, l);
        var iconSize = 30;
        return (w - iconSize) / 2 + iconSize;
    }

    function calculateNodeWidth(d, l) {
        return RED.nodes.NODE_WIDTH;
    }

    function calculateNodeHeight(d, properties) {
        return RED.nodes.NODE_HEIGHT;
    }

    function resetMouseVars() {
        mousedown_node = null;
        mouseup_node = null;
        mousedown_link = null;
        mouse_mode = 0;
        mousedown_port_type = 0;
    }

    function portMouseDown(d,portType,portIndex) {
        // disable zoom
        //vis.call(d3.behavior.zoom().on("zoom"), null);
        mousedown_node = d;
        setSelectedLink(null);
        mouse_mode = RED.state.JOINING;
        mousedown_port_type = portType;
        mousedown_port_index = portIndex || 0;
        document.body.style.cursor = "crosshair";
        d3.event.preventDefault();
    }

    function portMouseUp(d,portType,portIndex) {
        document.body.style.cursor = "";
        if (mouse_mode == RED.state.JOINING && mousedown_node) {
            if (typeof TouchEvent != "undefined" && d3.event instanceof TouchEvent) {
                RED.nodes.eachNode(function(n) {
                        if (n.z == active_ws) {
                            var hw = n.w/2;
                            var hh = n.h/2;
                            if (n.x-hw<mouse_position[0] && n.x+hw> mouse_position[0] &&
                                n.y-hh<mouse_position[1] && n.y+hh>mouse_position[1]) {
                                    mouseup_node = n;
                                    portType = mouseup_node._def.inputs>0?1:0;
                                    portIndex = 0;
                            }
                        }
                });
            } else {
                mouseup_node = d;
            }
            if (portType == mousedown_port_type) {
                if (portType === 0) {
                    RED.notify("Cannot connect an output port with another output port!");
                } else {
                    RED.notify("Cannot connect an input port with another input port!");
                }
                drag_line.attr("class", "drag_line_hidden");
                resetMouseVars();
                return;
            }

            if (mouseup_node === mousedown_node) {
                RED.notify("Cannot connect a device with itself!");
                drag_line.attr("class", "drag_line_hidden");
                resetMouseVars();
                return;
            }

            var src,dst,src_port,dst_port;
            if (mousedown_port_type == 0) {
                src = mousedown_node;
                dst = mouseup_node;
                src_port = mousedown_port_index;
                dst_port = portIndex;
            } else if (mousedown_port_type == 1) {
                src = mouseup_node;
                dst = mousedown_node;
                src_port = portIndex;
                dst_port = mousedown_port_index;
            }

            var existingLink = false;
            RED.nodes.eachLink(function(d) {
                existingLink = existingLink || (d.source === src && d.target === dst && d.sourcePort == src_port);
            });
            if (!existingLink) {
                var canBeLinked = RED.nodes.canBeLinked(src, dst)
                if (canBeLinked.ok) {
                    var link = {source: src, sourcePort:src_port, target: dst, targetPort:dst_port};
                    RED.nodes.addLink(link);
                    // added in order to show link edit dialog immediately after adding the link
                    drag_line.attr("class", "drag_line_hidden");
                    setSelectedLink(link);
                    RED.editor.editLink(link);
                } else {
                    RED.notify(canBeLinked.error ?
                               canBeLinked.error :
                               "These devices cannot be linked", "error");
                }
            }
            setSelectedLink(null);
            setDirty(true);
            redraw();
        }
    }

    function nodeMouseUp(d) {
        /* if (mousedown_node == d && nodeClickElapsed > 0 && nodeClickElapsed < 750) {
            RED.editor.edit(d);
            nodeClickElapsed = 0;
            d3.event.stopPropagation();
            return;
        } */
        portMouseUp(d, d._def.inputs > 0 ? 1 : 0, 0);
    }

    function linkMouseUp(d) {
        if (mousedown_link == d && linkClickElapsed > 0 && linkClickElapsed < 750) {
            RED.editor.editLink(d);
            nodeClickElapsed = 0;
            d3.event.stopPropagation();
            return;
        }
    }

    function nodeMouseDown(d) {
        //var touch0 = d3.event;
        //var pos = [touch0.pageX,touch0.pageY];
        //RED.touch.radialMenu.show(d3.select(this),pos);
        if (mouse_mode == RED.state.IMPORT_DRAGGING) {
            RED.keyboard.remove(/* ESCAPE */ 27);
            updateSelection();
            setDirty(true);
            redraw();
            resetMouseVars();
            d3.event.stopPropagation();
            return;
        }
        mousedown_node = d;
        var now = Date.now();
        nodeClickElapsed = now-nodeClickTime;
        nodeClickTime = now;

        if (d.selected && d3.event.ctrlKey) {
            d.selected = false;
            for (var i=0;i<moving_set.length;i+=1) {
                if (moving_set[i].n === d) {
                    moving_set.splice(i,1);
                    break;
                }
            }
        } else {
            if (d3.event.shiftKey) {
                clearSelection();
                var cnodes = RED.nodes.getAllFlowNodes(mousedown_node);
                for (var i in cnodes) {
                    cnodes[i].selected = true;
                    cnodes[i].dirty = true;
                    moving_set.push({n:cnodes[i]});
                }
            } else if (!d.selected) {
                if (!d3.event.ctrlKey) {
                    clearSelection();
                }
                mousedown_node.selected = true;
                moving_set.push({n:mousedown_node});
            }
            setSelectedLink(null);
            if (d3.event.button != 2) {
                mouse_mode = RED.state.MOVING;
                var mouse = d3.touches(this)[0]||d3.mouse(this);
                mouse[0] += d.x-d.cx;
                mouse[1] += d.y-d.cy;
                for (var i in moving_set) {
                    moving_set[i].ox = moving_set[i].n.x;
                    moving_set[i].oy = moving_set[i].n.y;
                    moving_set[i].dx = moving_set[i].n.x-mouse[0];
                    moving_set[i].dy = moving_set[i].n.y-mouse[1];
                }
                mouse_offset = d3.mouse(document.body);
                if (isNaN(mouse_offset[0])) {
                    mouse_offset = d3.touches(document.body)[0];
                }
            }
        }
        d.dirty = true;
        updateSelection();
        redraw();
        d3.event.stopPropagation();
    }

    function linkMouseDown(d) {
        mousedown_link = d;
        var now = Date.now();
        linkClickElapsed = now-linkClickTime;
        linkClickTime = now;

        clearSelection();
        setSelectedLink(mousedown_link);
        updateSelection();
        redraw();
        d3.event.stopPropagation();
    }
    
    function deselectEverything() {
        try {
            window.getSelection().removeAllRanges();
        } catch(error) {
            console.log("deselect failed: " + error);
            document.selection.empty();
        }
    }

    function showTouchMenu(obj,pos) {
        var mdn = mousedown_node;
        var options = [];
        options.push({name:"delete",disabled:(moving_set.length==0),onselect:function() {deleteSelection();}});
        options.push({name:"cut",disabled:(moving_set.length==0),onselect:function() {copySelection();deleteSelection();}});
        options.push({name:"copy",disabled:(moving_set.length==0),onselect:function() {copySelection();}});
        options.push({name:"paste",disabled:(clipboard.length==0),onselect:function() {importNodes(clipboard,true,true,true);}});
        options.push({name:"edit",disabled:(moving_set.length != 1),onselect:function() { RED.editor.edit(mdn);}});
        options.push({name:"select",onselect:function() {selectAll();}});
        
        RED.touch.radialMenu.show(obj,pos,options);
        resetMouseVars();
    }

    function redraw() {
        var scaleFactor = getWorkspaceStatus(active_ws).scaleFactor;
        vis.attr("transform","scale("+scaleFactor+")");
        outer.attr("width", space_width*scaleFactor).attr("height", space_height*scaleFactor);

        if (redrawBackground) {
            redrawBackground = false;
            if (options.backgroundImage) {
                // image background (grey if not found, and when out of image boundaries)
                $("#tab_bg_image")
                    .attr("xlink:href", options.backgroundImage.url)
                    .attr("href", options.backgroundImage.url)
                    .attr('width', options.backgroundImage.w)
                    .attr('height', options.backgroundImage.h)
                    .attr('class', "bg_image");
                outer_background.attr('fill','url(#tab_bg_pattern)');
            } else {
                // white background
                outer_background.attr('fill','#fff');
            }
        }

        var nodes = redrawNodes();

        redrawLinks();

        if (nodes) {
            nodes.each(function(d,i) {
                d.dirty = false;
            });
        }

        if (d3.event) {
            d3.event.preventDefault();
        }

        redrawAllNodes = false;
    }

    function nodeInBinRegion(node) {
        return node.x >= 1000 && node.x <= 1320 && node.y >= 20 && node.y <= 320;
    }

    function checkWearablePos(node) {
        var w = RED.nodes.NODE_WIDTH / 2;
        var h = RED.nodes.NODE_HEIGHT / 2;

        if (node.x < 25 + w) {
            node.x = 25 + w;
        } else if (node.x > 310 - w) {
            node.x = 310 - w;
        }
        if (node.y < 75 + h) {
            node.y = 75 + h;
        } else if (node.y > 210 - h) {
            node.y = 210 - h;
        }
    }

    function redrawNodes()
    {
        var nodes = vis.selectAll(".nodegroup").data(
            RED.nodes.nodes.filter(shouldDisplayNode),
            function(d){return d.id+":"+nodeGeneration});
        nodes.exit().remove();

        var nodeEnter = nodes.enter()
            .append("svg:g")
            .attr("class", "node nodegroup");

        nodeEnter.each(function(d,i) {
            var node = d3.select(this);
            node.attr("id",d.id);
            d.w = 200;
            d.h = 32;
            d.cx = 100;
            d.cy = 16;

            var mainRect = node.append("rect")
                .attr("class", "node")
                .classed("node_unknown",function(d) { return d.type == "unknown"; })
                .attr("rx", 6)
                .attr("ry", 6)
                .attr("fill",nodeColor);

            mainRect.on("mouseup",nodeMouseUp)
                .on("mousedown",nodeMouseDown)
                .on("touchstart",function(d) {
                    var obj = d3.select(this);
                    var touch0 = d3.event.touches.item(0);
                    var pos = [touch0.pageX,touch0.pageY];
                    startTouchCenter = [touch0.pageX,touch0.pageY];
                    startTouchDistance = 0;
                    touchStartTime = setTimeout(function() {
                        showTouchMenu(obj,pos);
                    },touchLongPressTimeout);
                    nodeMouseDown.call(this,d)       
                })
                .on("touchend", function(d) {
                    clearTimeout(touchStartTime);
                    touchStartTime = null;
                    if  (RED.touch.radialMenu.active()) {
                        d3.event.stopPropagation();
                        return;
                    }
                    nodeMouseUp.call(this,d);
                })
                .on("mouseover",function(d) {
                    if (mouse_mode == 0) {
                        var node = d3.select(this);
                        node.classed("node_hovered",true);
                    }
                })
                .on("mouseout",function(d) {
                    var node = d3.select(this);
                    node.classed("node_hovered",false);
                });
            
            // handle title
            if (!d._def.titleless) {
                node.append('svg:text')
                    .attr('class','node_label')
                    .attr('x', function(d) {return calculateTextStart(d)})
                    .attr('y', function(d) {
                        return getValue(d._def.label, d).includes(" ") ? 12 : 20;
                    })
                    .attr('dy', '.35em')
                    .attr('text-anchor','middle');

                node.append('svg:text')
                    .attr('class','node_label2')
                    .attr('x', function(d) {return calculateTextStart(d)})
                    .attr('y', "30")
                    .attr('dy', '.35em')
                    .attr('text-anchor','middle');

                if (d._def.icon) {
                    var icon_group = node.append("g")
                        .attr("class","node_icon_group");

                    var icon = icon_group.append("image")
                        .attr("xlink:href","icons/"+d._def.icon)
                        .attr("class","node_icon")
                        .attr("x",2)
                        .attr("y",6)
                        .attr("width","32")
                        .attr("height","32");

                    var img = new Image();
                    img.src = "icons/"+d._def.icon;
                    img.onload = function() {
                        icon.attr("width",Math.min(img.width,32));
                        icon.attr("height",Math.min(img.height,32));
                        icon.attr("x",2 + 16-Math.min(img.width,32)/2);
                    }
                    
                    //icon.style("pointer-events","none");
                    icon_group.style("pointer-events","none");
                }
            }
        });

        nodes.each(function(d,i) {
            // if (redrawAllNodes || d.dirty) {
            if (true) {

                // Delete nodes if dragged to the bin
                if (mousedown_node !== d && nodeInBinRegion(d)) {
                    deleteSelection();
                }

                // Move wearables to wearable rect when the user tries to drag them out of it
                if (mousedown_node !== d && d._def.modality === "wearable") {
                    checkWearablePos(d);
                }

                var showProperties = true;

                var props = []; // showProperties ? getPropertiesForDisplay(d) : [];
                d.w = calculateNodeWidth(d, getValue(d._def.label, d));
                d.h = calculateNodeHeight(d, props);
                d.cx = d.w/2;
                d.cy = d.h/2;

                var thisNode = d3.select(this);
                thisNode.attr("transform", "translate(" + (d.x-d.cx) + "," + (d.y-d.cy) + ")");
                if (showProperties) {
                    thisNode.selectAll(".node")
                        .style("visibility", "visible")
                        .attr("width",d.w)
                        .attr("height",d.h)
                        .attr("fill",nodeColor)
                        .classed("node_selected",function(d) { return d.selected; })
                        .classed("node_highlighted",function(d) { return d.highlighted; })
                    ;
                    thisNode.selectAll(".node_icon_group").style("visibility", "visible");
                }
                else {
                    thisNode.selectAll(".node").style("visibility", "hidden");
                    thisNode.selectAll(".node_icon_group").style("visibility", "hidden");
                }

                var numOutputs = d.outputs;
                var y = (d.h/2)-((numOutputs-1)/2)*13;
                d.outPorts = d.outPorts || d3.range(numOutputs);
                d._outPorts = thisNode.selectAll(".port_output").data(d.outPorts);
                d._outPorts.enter().append("rect")
                    .attr("class","port port_output")
                    .attr("rx",3)
                    .attr("ry",3)
                    .attr("width",20)
                    .attr("height",20)
                    .on("mousedown",function(){var node = d; return function(d,i){portMouseDown(node,0,i);}}() )
                    .on("touchstart",function(){var node = d; return function(d,i){portMouseDown(node,0,i);}}() )
                    .on("mouseup",function(){var node = d; return function(d,i){portMouseUp(node,0,i);}}() )
                    .on("touchend",function(){var node = d; return function(d,i){portMouseUp(node,0,i);}}() )
                    .on("mouseover",function(d,i) {
                        var port = d3.select(this);
                        port.classed("port_hovered",(mouse_mode!=RED.state.JOINING || mousedown_port_type != 0 ));
                    })
                    .on("mouseout",function(d,i) {
                        var port = d3.select(this);
                        port.classed("port_hovered",false);
                    });
                d._outPorts.exit().remove();
                if (d._outPorts) {
                    var numOutputs = d.outputs || 1;
                    var y = -5 + (d.h/2)-((numOutputs-1)/2)*13;
                    var x = d.w - 10;
                    var portsNode = d;
                    d._outPorts.each(function(d,i) {
                        var port = d3.select(this);
                        port.attr("y",(y+13*i)-5).attr("x",x);

                        var canConnect = mouse_mode === RED.state.JOINING
                            && mousedown_port_type !== 0
                            && portsNode !== mousedown_node
                            // can be linked from  this (port's) node to mousedown_node
                            && RED.nodes.canBeLinked(portsNode, mousedown_node).protocolsOk;
                        port.classed("port_connectable", canConnect);
                    });
                }

                var numInputs = d.inputs;
                var y = (d.h/2)-((numInputs-1)/2)*13;
                d.inPorts = d.inPorts || d3.range(numInputs);
                d._inPorts = thisNode.selectAll(".port_input").data(d.inPorts);
                d._inPorts.enter().append("rect")
                    .attr("class","port port_input")
                    .attr("rx",3)
                    .attr("ry",3)
                    .attr("width",20)
                    .attr("height",20)
                    .attr("x",-10)
                    .on("mousedown",function(){var node = d; return function(d,i){portMouseDown(node,1,i);}}() )
                    .on("touchstart",function(){var node = d; return function(d,i){portMouseDown(node,1,i);}}() )
                    .on("mouseup",function(){var node = d; return function(d,i){portMouseUp(node,1,i);}}() )
                    .on("touchend",function(){var node = d; return function(d,i){portMouseUp(node,1,i);}}() )
                    .on("mouseover",function(d,i) {
                        var port = d3.select(this);
                        port.classed("port_hovered",(mouse_mode!=RED.state.JOINING || mousedown_port_type != 1 ));
                    })
                    .on("mouseout",function(d,i) {
                        var port = d3.select(this);
                        port.classed("port_hovered",false);
                    });
                d._inPorts.exit().remove();
                if (d._inPorts) {
                    var numInputs = d.inputs || 1;
                    var y = -5 + (d.h/2)-((numInputs-1)/2)*13;
                    var portsNode = d;
                    d._inPorts.each(function(d,i) {
                        var port = d3.select(this);
                        port.attr("y",(y+13*i)-5);

                        var canConnect = mouse_mode === RED.state.JOINING
                            && mousedown_port_type !== 1
                            && portsNode !== mousedown_node
                            // can be linked from mousedown_node to this (port's) node
                            && RED.nodes.canBeLinked(mousedown_node, portsNode).protocolsOk;
                        port.classed("port_connectable", canConnect);
                    });                    
                }

                thisNode.selectAll('text.node_label').text(function(d,i){
                    var label = getValue(d._def.label, d);
                    if (label.includes(" ")) {
                        return label.split(" ")[0];
                    }
                    return label;
                })
                    .attr('y', function(d) {
                        return getValue(d._def.label, d).includes(" ") ? 12 : 20;
                    });

                thisNode.selectAll('text.node_label2').text(function(d,i){
                    var label = getValue(d._def.label, d);
                    if (label.includes(" ")) {
                        return label.split(" ")[1];
                    }
                    return "";
                });
            }
        });

        return nodes;
    }

    function getColor(link) {
        var p = RED.options.getProtocolByName(link.protocol);
        if (p) {
            return p.color;
        }
        // not found; color it in something that's easily noticeable
        return "rgb(255, 0, 255)";
    }

    function redrawLinks(nodes)
    {
        var node_width = +options.taskWidth;
        var node_height = +options.taskHeight;
        var links = vis.selectAll(".link").data(
            RED.nodes.links.filter(shouldDisplayNode),
            function(d) {
                return d.source.id+":"+d.sourcePort+":"+d.target.id+":"+d.targetPort+":"+nodeGeneration
            });

        var linkEnter = links.enter()
            .insert("g",".node")
            .attr("class","link");

        linkEnter.each(function(d,i) {
            var l = d3.select(this);
            l.append("svg:path").attr("class","link_background link_path")
                .on("mousedown", linkMouseDown)
                .on("mouseup", linkMouseUp)
                .on("touchstart",function(d) {
                    mousedown_link = d;
                    clearSelection();
                    setSelectedLink(mousedown_link);
                    updateSelection();
                    redraw();
                    d3.event.stopPropagation();
                });
            // always-black background line
            l.append("svg:path").attr("class","link_outline link_path");
            // colored foreground
            l.append("svg:path")
                .attr("class","link_line link_path")
                .attr("stroke", function(d) {return getColor(d)});
        });

        links.exit().remove();

        var paths = vis.selectAll(".link_path");
        var lines = vis.selectAll(".link_line");

        /* disabled: not working properly when adding new links as canvasMouseUp() resets he link state */
        /* if (!(redrawAllNodes || mouse_mode == RED.state.JOINING || mouse_mode == RED.state.EDITING_LINK)) {
            // reset attributes to just those links that have dirty nodes, to be faster
            paths = paths.filter(function(d){
                return d.source.dirty || d.target.dirty;
            })
            lines = lines.filter(function(d){
                return d.source.dirty || d.target.dirty;
            })
        } */

        lines.attr("stroke",function(d){return getColor(d)});

        paths.attr("d",function(d){
            var start, end, mid;
            var numOutputs = d.source.outputs || 1;
            var numInputs = d.target.inputs || 1;
            var sourcePort = d.sourcePort || 0;
            var targetPort = d.targetPort || 0;
            var srcY = -((numOutputs-1)/2)*13 +13*sourcePort;
            var dstY = -((numInputs-1)/2)*13 +13*targetPort;

            var dy = d.target.y+dstY-(d.source.y+srcY);
            var dx = (d.target.x-d.target.w/2)-(d.source.x+d.source.w/2);
            var delta = Math.sqrt(dy*dy+dx*dx);
            var scale = lineCurveScale;
            var scaleY = 0;
            if (delta < node_width) {
                scale = 0.75-0.75*((node_width-delta)/node_width);
            }

            if (dx < 0) {
                scale += 2*(Math.min(5*node_width,Math.abs(dx))/(5*node_width));
                if (Math.abs(dy) < 3*node_height) {
                    scaleY = ((dy>0)?0.5:-0.5)*(((3*node_height)-Math.abs(dy))/(3*node_height))*(Math.min(node_width,Math.abs(dx))/(node_width)) ;
                }
            }

            d.x1 = d.source.x+d.source.w/2;
            d.y1 = d.source.y+srcY;
            d.x2 = d.target.x-d.target.w/2;
            d.y2 = d.target.y+dstY;

            d.width = +options.linkWidth;
            d.height = calculateNodeHeight(d, getPropertiesForDisplay(d));

            d.rectStartX = (d.x1+d.x2)/2 - d.width/2;
            d.rectStartY = (d.y1+d.y2)/2 - d.height/2;

            start = {x: d.source.x+d.source.w/2-d.rectStartX,
                     y: d.source.y+srcY-d.rectStartY};
            end = {x: d.target.x-d.target.w/2-d.rectStartX,
                   y: d.target.y+dstY-d.rectStartY};
            if (d.source === d.target) { // link to self
                mid = {x1: node_width/2, x2: -node_width/2,
                       y1: node_height*3, y2: node_height*3};
            }  else {
                mid = {x1:scale*node_width, x2:-scale*node_width,
                       y1:scaleY*node_height, y2:-scaleY*node_height};
            }
            return "M "+start.x+" "+start.y +
                " C "+(start.x+mid.x1)+" "+(start.y+mid.y1)+" "+
                (end.x+mid.x2)+" "+(end.y+mid.y2)+" "+end.x+" "+end.y;
        })

        function getStrokeWidth(txPercent, minVal, maxVal) {
            return Math.round(Math.max(minVal, txPercent / (100.0 / maxVal)));
        }

        // calculate the link width
        var maxLinkPdr = 0.0;
        var minLinkPdr = 1.0;
        links.each(function(d,i) {
            var txP = RED.nodes.getLinkAttr(d, "txP").value;
            if (maxLinkPdr < txP) maxLinkPdr = txP;
            if (minLinkPdr > txP) minLinkPdr = txP;
        });
        //console.log("min,max=" + minLinkPdr + " " + maxLinkPdr);
        var d = 1.0;
        if (minLinkPdr == 0) {
            if (maxLinkPdr != 0) d = 4.0;
        } else if (maxLinkPdr / minLinkPdr > 10) {
            d = 4;
        } else if (maxLinkPdr / minLinkPdr > 5) {
            d = 3;
        } else if (maxLinkPdr / minLinkPdr > 2) {
            d = 2;
        }
        var minWidth = 4.0 / d, maxWidth = Math.min(4.0 * d, 10.0);

        links.each(function(d,i) {
            var thisLink = d3.select(this);

            thisLink.attr("transform", "translate(" + d.rectStartX + "," + d.rectStartY + ")");
        })

        links.classed("link_selected", function(d) { return /*d === selected_link || */ d.selected; });
        links.classed("link_invalid", function(d) { return !d.valid; });
        links.classed("link_unknown",function(d) { return d.target.type == "unknown" || d.source.type == "unknown"});

        links.classed("link_user", function(d) { return d.valid && !d.selected && d.user; });
    }

    RED.keyboard.add(/* a */ 65,{ctrl:true},function(){selectAll();d3.event.preventDefault()});
    RED.keyboard.add(/* = */ 187,{ctrl:true},function(){zoomIn();d3.event.preventDefault()});
    RED.keyboard.add(/* - */ 189,{ctrl:true},function(){zoomOut();d3.event.preventDefault()});
    RED.keyboard.add(/* 0 */ 48,{ctrl:true},function(){zoomZero();d3.event.preventDefault()});
    RED.keyboard.add(/* v */ 86,{ctrl:true},function(){importNodes(clipboard,false,true,true);d3.event.preventDefault()});
    RED.keyboard.add(/* e */ 69,{ctrl:true},function(){showExportNodesDialog();d3.event.preventDefault()});
    RED.keyboard.add(/* i */ 73,{ctrl:true},function(){showImportNodesDialog();d3.event.preventDefault()});

    // TODO: 'dirty' should be a property of RED.nodes - with an event callback for ui hooks
    function setDirty(d) {
        dirty = d;
    }

    /**
     * Imports a new collection of nodes from a JSON String.
     *  - all get new IDs assigned
     *  - all 'selected'
     *  - attached to mouse for placing - 'IMPORT_DRAGGING'
     */
    function importNodes(newNodesStr,touchImport,dontClear,isPasted) {
        if (clearOnImport && !dontClear) {
            nodeGeneration += 1;
            RED.nodes.removeAll();
        }
        try {
            var result = RED.nodes.importNodes(newNodesStr,true);

            if (result) {
                var new_nodes = result.nodes;
                var new_links = result.links;
                var new_node_ids = new_nodes.map(function(n){ return n.id; });

                var node_width = +options.taskWidth;
                var node_height = +options.taskHeight;

                var workspace_to_activate = null;
                new_nodes.forEach(function(n) {
                    var ws = n.z ? RED.nodes.workspace(n.z) : null;
                    if (!ws) {
                        ws = RED.nodes.defaultWorkspace;
                        n.z = ws.id;
                    }
                    workspace_to_activate = ws.id;
                });

                if (workspace_to_activate && active_ws !== workspace_to_activate) {
                    workspace_tabs.activateTab(workspace_to_activate);
                }

                var new_ms = new_nodes
                    .filter(function(n) { return n.z === active_ws })
                    .map(function(n) { return {n:n} });

                if (new_ms.length) {
                    // TODO: pick a more sensible root node
                    var root_node = new_ms[0].n;

                    var dx = root_node.x;
                    var dy = root_node.y;

                    if (mouse_position == null) {
                        mouse_position = [0,0];
                    }

                    var minX = 0;
                    var minY = 0;

                    for (var i in new_ms) {
                        var node = new_ms[i];
                        node.n.selected = true;
                        node.n.changed = true;
                        node.n.x -= dx - mouse_position[0];
                        node.n.y -= dy - mouse_position[1];
                        node.dx = node.n.x - mouse_position[0];
                        node.dy = node.n.y - mouse_position[1];
                        minX = Math.min(node.n.x-node_width/2-5,minX);
                        minY = Math.min(node.n.y-node_height/2-5,minY);
                    }
                    for (var i in new_ms) {
                        var node = new_ms[i];
                        node.n.x -= minX;
                        node.n.y -= minY;
                        node.dx -= minX;
                        node.dy -= minY;
                    }
                    if (!touchImport) {
                        mouse_mode = RED.state.IMPORT_DRAGGING;
                    }

                    RED.keyboard.add(/* ESCAPE */ 27,function(){
                        RED.keyboard.remove(/* ESCAPE */ 27);
                        clearSelection();
                        mouse_mode = 0;
                    });
                } else if (isPasted) {
                    // move them a bit to avoid overlapping with source nodes
                    new_nodes.forEach(function(n) {
                        // XXX: also could put in viepoint center
                        n.x += 20;
                        n.y += 20;
                    });
                }

                clearSelection();
                moving_set = new_ms;

                redraw();
            }
        } catch(error) {
            console.log(error);
            RED.notify("<strong>Error</strong>: "+error,"error");
        }
    }

    $('#btn-import').click(function() {showImportNodesDialog()});
    $('#btn-export-clipboard').click(function() {showExportNodesDialog()});
    $('#btn-export-library').click(function() {showExportNodesLibraryDialog()});

    function toggleClearOnImport() {
        $('#btn-clear-on-import').toggleClass("active");
        clearOnImport = $('#btn-clear-on-import').hasClass("active");
    }
    $('#btn-clear-on-import').click(toggleClearOnImport);
    toggleClearOnImport();

    $('#btn-import-background').click(function() {
        $( "#import-background-dialog" ).dialog("option","title","Import background image").dialog( "open" )
    });

    function clearDevices() {
        nodeGeneration += 1;
        RED.nodes.removeAll();
        redrawBackground = true;
        redraw();
        RED.notify("Devices removed");
    }

    function clearAchievements() {
        RED.achievements.reset();
        RED.notify("Achievements cleared");
    }

    $('#btn-clear-devices').click(function() {
        clearDevices();

        $( "#node-dialog-confirm-clear-devices" ).hide();
        $( "#node-dialog-confirm-clear-achievements" ).show();
        $( "#node-dialog-confirm-clear" ).dialog("open");
    });

    $('#btn-clear-achievements').click(function() {
        clearAchievements();

        $( "#node-dialog-confirm-clear-devices" ).show();
        $( "#node-dialog-confirm-clear-achievements" ).hide();
        $( "#node-dialog-confirm-clear" ).dialog("open");
    });

    function showIntro() {
        var dialog = $('#node-dialog-intro1');
        dialog.modal();
    }

    $('#btn-show-intro').click(showIntro);
    $('#btn-show-intro-main').click(showIntro);

    $( "#dialog-intro1-button" ).click(function() {
        var dialog = $('#node-dialog-intro2');
        dialog.modal();
    });

    $('#btn-show-about').click(function() {
        $('#node-dialog-about').modal();
    });

    function formatAchievement(name, isDone) {
        // add a list item with the achievements name and link to it (if not done)
        var r = '<li><a tabindex="-1" ';
        if (isDone) {
            r += 'onclick="RED.game.showAchievementByName(\'' + name + '\', true)"';
        } else {
            r += 'disabled="disabled"';
        }
        r += '><span class="' + (isDone ? "active" : "inactive") + '">';
        r += '<i class="icon-ok pull-right"></i><i class="icon-list-alt"></i> ' + name + '</span></a></li>';
        return r;
    }

    $('#btn-achievements').click(function() {
        var achievements = RED.achievements.getAll();
        var items = [];

        for (var i = 0; i < achievements[0].length; ++i) {
            items.push(formatAchievement(achievements[0][i], true));
        }
        if (items.length === 0) {
            items.push('<li><a tabindex="-1" href="#"><i class="icon-ok pull-right"></i> No achievements</a></li>');
        }

        items.push('<li class="divider"></li>');

        for (var i = 0; i < achievements[1].length; ++i) {
            items.push(formatAchievement(achievements[1][i], false));
        }
        
        $( '#achievement-list' ).empty().append(items.join(""));
    });

    function showExportNodesDialog() {
        var nns;
        mouse_mode = RED.state.EXPORT;
        if (moving_set.length == 0) {
            nns = RED.nodes.createCompleteNodeSet(function() {return true});
        } else {
            nns = RED.nodes.createExportableNodeSet(moving_set);
        }
        $("#dialog-form").html($("script[data-template-name='export-clipboard-dialog']").html());
        $("#node-input-export").val(JSON.stringify(nns));
        $("#node-input-export").focus(function() {
                var textarea = $(this);
                textarea.select();
                textarea.mouseup(function() {
                        textarea.unbind("mouseup");
                        return false;
                });
        });
        $( "#dialog" ).dialog("option","title","Export nodes to clipboard").dialog( "open" );
        $("#node-input-export").focus();
    }

    function showExportNodesLibraryDialog() {
        var nns;
        mouse_mode = RED.state.EXPORT;
        if (moving_set.length == 0) {
            nns = RED.nodes.createCompleteNodeSet(function() {return true});
        } else {
            nns = RED.nodes.createExportableNodeSet(moving_set);
        }
        $("#dialog-form").html($("script[data-template-name='export-library-dialog']").html());
        $("#node-input-filename").attr('nodes',JSON.stringify(nns));
        $( "#dialog" ).dialog("option","title","Export nodes to library").dialog( "open" );
    }

    function showImportNodesDialog() {
        mouse_mode = RED.state.IMPORT;
        $("#dialog-form").html($("script[data-template-name='import-dialog']").html());
        $("#node-input-import").val("");
        $( "#dialog" ).dialog("option","title","Import nodes").dialog( "open" );
    }

    function showRenameWorkspaceDialog(id) {
        var ws = RED.nodes.workspace(id);
        $( "#node-dialog-rename-workspace" ).dialog("option","workspace",ws);

        if (workspace_tabs.count() == 1) {
            $( "#node-dialog-rename-workspace").next().find(".leftButton")
                .prop('disabled',true)
                .addClass("ui-state-disabled");
        } else {
            $( "#node-dialog-rename-workspace").next().find(".leftButton")
                .prop('disabled',false)
                .removeClass("ui-state-disabled");
        }

        $( "#node-input-workspace-name" ).val(ws.label);
        $( "#node-dialog-rename-workspace" ).dialog("open");
    }

    $( "#node-dialog-rename-workspace form" ).submit(function(e) { e.preventDefault()});
    $( "#node-dialog-rename-workspace" ).dialog({
        modal: true,
        autoOpen: false,
        width: 500,
        title: "Rename sheet",
        buttons: [
            {
                class: 'leftButton',
                text: "Delete",
                id: "btn-dialog-workspace-delete",
                click: function() {
                    var workspace = $(this).dialog('option','workspace');
                    $( this ).dialog( "close" );
                    deleteWorkspace(workspace.id);
                }
            },
            {
                text: "Ok",
                click: function() {
                    var workspace = $(this).dialog('option','workspace');
                    var label = $( "#node-input-workspace-name" ).val();
                    if (workspace.label != label) {
                        workspace.label = label;
                        var link = $("#workspace-tabs a[href='#"+workspace.id+"']");
                        link.attr("title",label);
                        link.text(label);
                        setDirty(true);
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
        ],
        open: function(e) {
            RED.keyboard.disable();
        },
        close: function(e) {
            RED.keyboard.enable();
        }
    });
    $( "#node-dialog-delete-workspace" ).dialog({
        modal: true,
        autoOpen: false,
        width: 500,
        title: "Confirm delete",
        buttons: [
            {
                text: "Ok",
                click: function() {
                    var workspace = $(this).dialog('option','workspace');
                    RED.view.removeWorkspace(workspace);
                    RED.nodes.removeWorkspace(workspace.id);
                    setDirty(true);
                    $( this ).dialog( "close" );
                }
            },
            {
                text: "Cancel",
                click: function() {
                    $( this ).dialog( "close" );
                }
            }
        ],
        open: function(e) {
            RED.keyboard.disable();
        },
        close: function(e) {
            RED.keyboard.enable();
        }
    });

    $( "#dialog-visual-options" ).dialog({
        title: "Visual options",
        modal: true,
        autoOpen: false,
        width: 600,
        height: 454,
        open: function() {
            RED.keyboard.disable();
            $( "#option-visual-task-width" ).val(options.taskWidth);
            $( "#option-visual-task-height" ).val(options.taskHeight);
            var url = "none";
            if (options.backgroundImage) {
                url = basename(options.backgroundImage.url);
            }
            $( "#option-visual-current-background" ).text(url);
        },
        close: function() {
            RED.keyboard.enable();
        },
        buttons: [
            {
                text: "Ok",
                click: function(event) {
                    var file = $( '#option-visual-background-filename' ).val();
                    if (file && file.length > 0) {
                        // upload the file
                        $( "#dialog-visual-options-form").submit();
                    }
                    options.taskWidth = $( "#option-visual-task-width" ).val();
                    options.taskHeight = $( "#option-visual-task-height" ).val();
                    setDirty(true);
                    redrawBackground = true;
                    redrawAllNodes = true;
                    redraw();
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

    showImportedBackground()

    function showImportedBackground(data) {
        //console.log("view: showImportedBackground");
        if (!data || !data.hasOwnProperty("url")) {
            options.backgroundImage = null;
        } else {
            options.backgroundImage = {url: data.url, w:data.width, h:data.height};
        }
        redrawBackground = true;
        setDirty(true);
        redraw();
    }

    $('#btn-vo-background-clear')
        .on("click",function(e) {showImportedBackground(null)});
    $('#btn-vo-background-set')
        .on("click",function(e) {
            var file = $( '#option-visual-background-filename' ).val();
            if (!file || file.length == 0) {
                e.preventDefault();
                RED.notify("Background image file not selected!", "error");
            }
        });

    $('#btn-visual-option-dlg').click(function() { $( "#dialog-visual-options" ).dialog( "open" ) });

    function showWorkspace(id) {
        if (active_ws !== id) {
            workspace_tabs.activateTab(id);
        } else {
            redraw();
        }
    }

    return {
        state:function(state) {
            if (state == null) {
                return mouse_mode
            } else {
                mouse_mode = state;
            }
        },
        addWorkspace: function(ws) {
            workspace_tabs.addTab(ws);
            workspace_tabs.resize();
        },
        removeWorkspace: function(ws) {
            workspace_tabs.removeTab(ws.id);
        },
        getWorkspace: function() {
            return active_ws;
        },
        showWorkspace: showWorkspace,
        redraw:redraw,
        dirty: function(d) {
            return d === undefined ? dirty : setDirty(d);
        },
        redrawAllNodes: function() {
            redrawAllNodes = true;
        },
        importNodes: importNodes,
        resize: function() {
            workspace_tabs.resize();
        },
        status: function(s) {
            showStatus = s;
            RED.nodes.eachNode(function(n) {n.dirty = true});
            //TODO: subscribe/unsubscribe here
            redraw();
        },
        showImportedBackground: showImportedBackground,
        importOptions: function(globalOptions) {
            // XXX: assume the background image is already uploaded on the server
            for (var n in globalOptions.visual) {
                options[n] = globalOptions.visual[n];
            }
            redrawBackground = true; // in case changed
        },
        exportOptions: function(globalOptions) {
            globalOptions.visual = options;
        },
        resetOptions: resetOptions,
        setSelectedLink : setSelectedLink,
        showSelected : showSelected,
        clearDevices : clearDevices,
        clearAchievements : clearAchievements,
        showIntro : showIntro,
    };
}();
