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
RED.nodes = function() {

    var node_defs_expected = {};
    var node_defs = {};
    var nodes = [];
    var links = [];
    var defaultWorkspace;
    var netWorkspace;
    var allocationWorkspace;
    var workspaces = {};

    // keep these fixed to simplify things
    var NODE_HEIGHT = 42;
    var NODE_WIDTH = 174;

    function expectType(nt) {
        node_defs_expected[nt] = 1;
    }

    function registerType(nt,def) {     
        node_defs[nt] = def;

        // TODO: too tightly coupled into palette UI
        RED.palette.add(nt,def);

        delete node_defs_expected[nt];
        if (!Object.keys(node_defs_expected).length) {
            // all nodes imported; time to load flows
            RED.loadFlows();
        }
    }

    function getType(type) {
        return node_defs[type];
    }

    function getAllTypesOfCategory(category) {
        var result = [];
        for (var n in node_defs) {
            if (node_defs[n].category === category) result.push(n);
        }
        return result;
    }

    function canAddNode(newNode) {
        var currentCredits = calculateCredits();
        if (isNaN(currentCredits)) {
            return false;
        }
        var nodeValue = calculateCostForNode(newNode);
        return currentCredits + nodeValue <= RED.options.getOption("startingCredits");
    }

    function calculateCostForNode(n) {
        if (!n._def) {
            return 0;
        }
        var cost = n._def.defaults.cost;
        if (cost !== undefined) {
            cost = cost.value;
            if (cost !== undefined) {
                try {
                    cost = parseInt(cost);
                } catch(error) {
                    RED.notify("<strong>Error</strong>: "+error,"error");
                    cost = NaN;
                }
            }
        }
        if(isNaN(cost)) {
            return 0;
        }
        return cost;
    }

    function calculateCredits() {
        var currentCredits = 0;
        for (var n in nodes) {
            currentCredits += calculateCostForNode(nodes[n]);
        }
        return currentCredits;
    }

    // TODO: move this to UI!
    function updateCredits() {
        var remainingCredits =  RED.options.getOption("startingCredits") - calculateCredits();
        if (remainingCredits > 300) {
            // Low credits remaining: warn the user
            $( "#node-remaining-credits").removeClass("alert");
        } else {
            $( "#node-remaining-credits").addClass("alert");
        }
        $( "#node-remaining-credits").text("Remaining credits: " + remainingCredits + " cr");
    }

    function addNode(n) {
        n.dirty = true;
        nodes.push(n);
        updateCredits();
        n.status = {};
    }

    function getDistance(s, d) {
        var x = s.x + NODE_WIDTH - d.x;
        var y = s.y - d.y;

        return Math.sqrt(x * x + y * y);
    }

    //
    // Two nodes can be linked iff:
    // - they share a common communication protocols;
    // - this protocol works in that direction (e.g. USB host vs. client);
    // - they are not too far away.
    //
    function canBeLinked(s, d) {
        var result = {ok: false, protocolsOk : false, error: ""};
        var anyProtocol = false;
        var rightDirection = false;
        var distanceOk = false;

        var distance = getDistance(s, d);

        s._def.capabilities.forEach(function(key) {
            if (includes(d._def.capabilities, key)) {

                anyProtocol = true;

                if (!(s._def.capabilitiesOnlyInput && includes(s._def.capabilitiesOnlyInput, key)
                      || d._def.capabilitiesOnlyOutput && includes(d._def.capabilitiesOnlyOutput, key))) {
                    rightDirection = true;

                    var p = RED.options.getProtocolByName(key);
                    if (p && p.range >= distance) {
                        distanceOk = true;
                    }
                }
            }
        });

        result.protocolsOk = anyProtocol && rightDirection;
        result.ok = result.protocolsOk && distanceOk;
        if (!result.ok) {
            if (!anyProtocol) {
                if (s._def.modality === "wearable" || d._def.modality === "wearable") {
                    result.error = "Links to Wristband Sensors do not have to be configured: these devices are mobile and will automatically connect to nearby gateways";
                } else {
                    result.error = "These devices cannot be linked directly: they do not share any common communication protocols";
                }
            } else if (!rightDirection) {
                result.error = "These devices cannot be linked in this direction";
            } else {
                result.error = "These devices cannot be linked: they are too far away";
            }
        }
        return result;
    }

    function canBeLinkedWith(s, d, protocol, checkDistance) {
        if (!includes(s._def.capabilities, protocol)
            || !includes(d._def.capabilities, protocol)) {
            return false;
        }
        if (s._def.capabilitiesOnlyInput && includes(s._def.capabilitiesOnlyInput, protocol)
            || d._def.capabilitiesOnlyOutput && includes(d._def.capabilitiesOnlyOutput, protocol)) {
            return false;
        }
        if (checkDistance) {
            var distance = getDistance(s, d);
            var p = RED.options.getProtocolByName(protocol);
            if (!p || p.range < distance) {
                return false;
            }
        }
        return true;
    }

    function defaultLinkConfig() {
        return {
            titleless: true,
            defaults: {
                protocol: {value:"TSCH"}
            },
            validate: function() {
                //console.log("validate " + JSON.stringify(this));
                if (!this.protocol || !RED.options.getProtocolByName(this.protocol)) {
                    return false;
                }
                if (!this.source || !this.target) {
                    return false;
                }
                // check if the nodes support the protocol
                if (!canBeLinkedWith(this.source, this.target, this.protocol, true)) {
                    return false;
                }
                return true;
            }
        }
    }

    function addLink(l) {
        l.type = 'link';
        l.status = {};
        l._def = defaultLinkConfig();
        /* set the default values */
        for (var o in l._def.defaults) {
            if (!l.hasOwnProperty(o) /* && l[o] !== undefined */) {
                l[o] = l._def.defaults[o].value;
            }
        }
        l.valid = true;
        l.dirty = true;
        links.push(l);
    }
    function getNode(id) {
        for (var n in nodes) {
            if (nodes[n].id == id) {
                return nodes[n];
            }
        }
        return null;
    }
    function findNode(predicate) {
        for (var n in nodes) {
            if (predicate(nodes[n])) {
                return nodes[n];
            }
        }
        return null;
    }
    function findLink(predicate) {
        for (var n in links) {
            if (predicate(links[n])) {
                return links[n];
            }
        }
        return null;
    }

    function removeNode(id) {      
        var node = getNode(id);
        if (!node) {
            return [];
        }
        nodes.splice(nodes.indexOf(node),1);
        updateCredits();
        var removedLinks = links.filter(function(l) { return (l.source === node) || (l.target === node); });
        removedLinks.map(function(l) {links.splice(links.indexOf(l), 1); });

        return removedLinks;
    }

    function removeLink(l) {
        var index = links.indexOf(l);
        if (index != -1) {
            links.splice(index,1);
        }
    }

    // Note: the user cannot undo after this
    function removeAll(l) {
        for (var i in workspaces) {
            var ws = workspaces[i];
            if (removeWorkspace(ws.id).completelyRemoved) {
                RED.view.removeWorkspace(ws);
            }
        }
        RED.resetOptions();
        RED.view.resetOptions();
    }

    function refreshValidation() {
        for (var n in nodes) {
            RED.editor.validateNode(nodes[n]);
        }
    }

    function addWorkspace(ws) {
        workspaces[ws.id] = ws;

        if (ws.id === "net_tab") {
            netWorkspace = ws;
        }
        else if (ws.id === "alloc_tab") {
            allocationWorkspace = ws;
        }
        else if (!defaultWorkspace) {
            defaultWorkspace = ws;
        }
    }
    function getWorkspace(id) {
        return workspaces[id];
    }
    function removeWorkspace(id) {
        var completelyRemoved = true;
        if (workspaces[id] === defaultWorkspace) {
            // take first of remaining workspaces as the default
            var newDefaultWs = null;
            for (var w in workspaces) {
                if (w !== id
                        && workspaces[w] !== netWorkspace
                        && workspaces[w] !== allocationWorkspace) {
                    newDefaultWs = workspaces[w];
                    break;
                }
            }
            if (!newDefaultWs) {
                completelyRemoved = false;
            } else {
                defaultWorkspace = newDefaultWs;
            }
        }
        else if (workspaces[id] === netWorkspace
                 || workspaces[id] === allocationWorkspace) {
            completelyRemoved = false;
        }
        if (completelyRemoved) {
            delete workspaces[id];
        }

        var removedNodes = [];
        var removedLinks = [];
        for (var n in nodes) {
            var node = nodes[n];
            if (node.z == id) {
                removedNodes.push(node);
            }
        }
        for (var n in removedNodes) {
            var rmlinks = removeNode(removedNodes[n].id);
            removedLinks = removedLinks.concat(rmlinks);
        }
        return {nodes:removedNodes, links:removedLinks, completelyRemoved:completelyRemoved};
    }

    function getAllFlowNodes(node) {
        var visited = {};
        visited[node.id] = true;
        var nns = [node];
        var stack = [node];
        while(stack.length != 0) {
            var n = stack.shift();
            var childLinks = links.filter(function(d) { return (d.source === n) || (d.target === n);});
            for (var i in childLinks) {
                var child = (childLinks[i].source === n)?childLinks[i].target:childLinks[i].source;
                if (!visited[child.id]) {
                    visited[child.id] = true;
                    nns.push(child);
                    stack.push(child);
                }
            }
        }
        return nns;
    }

    /**
     * Converts a node to an exportable JSON Object
     **/
    function convertNode(n, extraFields, subobjects) {
        var node = {};
        node.id = n.id;
        node.type = n.type;
        for (var d in n._def.defaults) {
            var defval = n._def.defaults[d].value;
            if (n[d] != defval) {
                node[d] = n[d];
            } else if (defval !== "" && defval !== undefined && defval !== null) {
                // include only if not empty
                node[d] = defval;
            }
        }
        if (extraFields) {
            extraFields.forEach(function(d) {
                if (d in n) {
                    node[d] = n[d];
                }
            });
        }
        if (subobjects) {
            subobjects.forEach(function(d) {
                var o = n[d];
                node[d] = {};
                for (var dd in o) {
                    node[d][dd] = o[dd];
                }
            });
        }
        node.x = n.x;
        node.y = n.y;
        node.z = n.z;
        node.wires = [];
        for(var i=0;i<n.outputs;i++) {
            node.wires.push([]);
        }
        var wires = links.filter(function(d){return d.source === n});
        for (var i in wires) {
            var w = wires[i];

            // TODO: loop over link properties
            var obj = {task: w.target.id};
            if (w.sourcePort in node.wires) {
                node.wires[w.sourcePort].push(obj);
            } else {
                node.wires[w.sourcePort] = [obj];
            }
            obj.sourcePort = w.sourcePort;
            obj.targetPort = w.targetPort;
            if (w.hasOwnProperty("protocol")) {
                obj.protocol = w.protocol;
            }
        }
        return node;
    }

    function getLinkAttr(d, name) {
        var result = {value: "", category: -1};
        if (d.user && d.user.hasOwnProperty(name)) {
            result.value = d.user[name];
            result.category = 3;
        }
        else if (d.net && d.net.hasOwnProperty(name)) {
            result.value = d.net[name];
            result.category = 2;
        }
        else if (d.sim && d.sim.hasOwnProperty(name)) {
            result.value = d.sim[name];
            result.category = 1;
        }
        return result;
    }

    function convertLink(n, includeAllAttributes) {
        var result = {};
        result.type = "link";
        result.source = n.source.id;
        result.target = n.target.id;
        for (var d in n._def.defaults) {
            var defval = n._def.defaults[d].value;

            var val = includeAllAttributes ?
                getLinkAttr(n, d).value : 
                (n.user ? n.user[d] : undefined);
            if (val === undefined) val = "";

            if (val != defval) {
                result[d] = val;
            } else if (defval !== "" && defval !== undefined && defval !== null) {
                // include only if not empty
                result[d] = defval;
            }
        }
        return result;
    }

    /**
     * Converts the current node selection to an exportable JSON Object
     **/
    function createExportableNodeSet(set) {
        var nns = [];
        for (var n in set) {
            var node = set[n].n;
            var convertedNode = RED.nodes.convertNode(node);

            nns.push(convertedNode);
        }

        return nns;
    }

    function createCompleteNodeSet(predicate, includeAllAttributes, extraFields, subobjects) {
        var nns = [];
        for (var n in workspaces) {
            if (predicate(workspaces[n])) {
                nns.push(workspaces[n]);
            }
        }
        nodes.forEach(function(n) {
            if (predicate(n)) nns.push(convertNode(n, extraFields, subobjects));
        });

        var netLinks = links.filter(function(l) {
            return predicate(l) && l.source._def.category == "net"
        });
        netLinks.forEach(function(l) {
            nns.push(convertLink(l, includeAllAttributes));
        });

        // gather all options
        var options = {type:"options", id:"options"};
        if (predicate(options)) {
            RED.exportOptions(options);
            RED.view.exportOptions(options);
            nns.push(options);
        }

        return nns;
    }

    function importNodes(newNodesObj,createNewIds) {
        try {
            var newNodes;
            if (typeof newNodesObj === "string") {
                if (newNodesObj == "") newNodes = [];
                else newNodes = JSON.parse(newNodesObj);
            } else {
                newNodes = newNodesObj;
            }

            if (!$.isArray(newNodes)) {
                newNodes = [newNodes];
            }

            var unknownTypes = [];
            for (var i=0;i<newNodes.length;i++) {
                var n = newNodes[i];
                if (!(n.type in oc(["tab", "options", "link"]))
                        && !getType(n.type)) {
                    // TODO: get this UI thing out of here! (see below as well)
                    n.name = n.type;
                    n.type = "unknown";
                    if (unknownTypes.indexOf(n.name)==-1) {
                        unknownTypes.push(n.name);
                    }
                    if (n.x == null && n.y == null) {
                        // config node - remove it
                        newNodes.splice(i,1);
                        i--;
                    }
                }
            }
            if (unknownTypes.length > 0) {
                var typeList = "<ul><li>"+unknownTypes.join("</li><li>")+"</li></ul>";
                var type = "type"+(unknownTypes.length > 1?"s":"");
                RED.notify("<strong>Imported unrecognised "+type+":</strong>"+typeList,"error",false,10000);
                //"DO NOT DEPLOY while in this state.<br/>Either, add missing types to Node-RED, restart and then reload page,<br/>or delete unknown "+n.name+", rewire as required, and then deploy.","error");
            }

            var result = {
                nodes: [],
                links: [],
                options: {}
            };

            var workspaceMapping = {};
            for (var i in newNodes) {
                var n = newNodes[i];
                // TODO: search WS by name here and add nodes by name, not by ID!
                if (n.type === "tab" && !(n.id in workspaces)) {
                    var exists = false;
                    if (n.label) {
                        for (var w in workspaces) {
                            if (workspaces[w].label === n.label) {
                                exists = true;
                                workspaceMapping[n.id] = workspaces[w].id;
                                break;
                            }
                        }
                    }
                    if (!exists) {
                        workspaceMapping[n.id] = n.id;
                        addWorkspace(n);
                        RED.view.addWorkspace(n);
                    }
                }
                else if (n.type === "options") {
                    result.options = n;
                }
            }
            if (!defaultWorkspace) {
                defaultWorkspace = { type:"tab", id:getRandomID(), label:"SPHERE house 1"};
                addWorkspace(defaultWorkspace);
                RED.view.addWorkspace(defaultWorkspace);
            }

            var node_map = {};

            var allAdded = true;
            for (var i in newNodes) {
                var n = newNodes[i];
                if (!(n.type in oc(["tab", "options", "link"]))) {
                    var def = getType(n.type);
                    var node = {x:n.x,
                                y:n.y,
                                z:workspaceMapping[n.z]||n.z,
                                type:0,
                                wires:n.wires,
                                changed:false};
                    if (createNewIds) {
                        node.id = getRandomID();
                    } else {
                        node.id = n.id;
                    }
                    node.type = n.type;
                    node._def = def;
                    if (!node._def) {
                        node._def = {
                            color:"#fee",
                            defaults: {},
                            label: "unknown: "+n.type,
                            labelStyle: "node_label_italic",
                            outputs: n.outputs||n.wires.length
                        }
                    }
                    node.outputs = n.outputs||node._def.outputs;
                    node.inputs = n.inputs||node._def.inputs;

                    for (var d in node._def.defaults) {
                        node[d] = n[d];
                    }

                    if (canAddNode(node)) {
                        addNode(node);
                        node_map[n.id] = node;
                        result.nodes.push(node);
                    } else {
                        allAdded = false;
                    }
                }
            }
            if (!allAdded) {
                RED.notify("Cannot add all nodes: credit limit would be exceeded!", "error");
            }
            for (var i in newNodes) {
                var n = newNodes[i];
                if (n.type === "link") {
                    var link = {
                        source: getNode(n.source),
                        target: getNode(n.target)
                    };
                    addLink(link);
                    for (var d in link._def.defaults) {
                        link[d] = n[d];
                    }
                }
            }
            for (var i in result.nodes) {
                var n = result.nodes[i];
                RED.editor.validateNode(n);
                for (var w1 in n.wires) {
                    var wires = (n.wires[w1] instanceof Array)?n.wires[w1]:[n.wires[w1]];
                    for (var w2 in wires) {
                        if (wires[w2].task in node_map) {
                            var link = wires[w2];
                            link.source = n;
                            link.sourcePort = w1;
                            link.targetPort = wires[w2].targetPort;
                            link.target = node_map[wires[w2].task];
                            addLink(link);
                            result.links.push(link);
                        }
                    }
                }
                delete n.wires;
            }

            if (result.options) {
                RED.importOptions(result.options);
                RED.view.importOptions(result.options);
            }
            updateCredits();
            return result;
        }
        catch(error) {
            //TODO: get this UI thing out of here! (see above as well)
            RED.notify("<strong>Error</strong>: "+error,"error");
            updateCredits();
            return null;
        }
    }

    function getLinkProperties(link) {
        var r = {};
        for (var n in link._def.defaults) {
            var val = link[n]||"";
            r[n] = val;
        }
        var distance = getDistance(link.source, link.target);
        r.length = Math.round(distance / RED.options.getOption("distanceMetersToPixels"));
        var props = RED.options.getProtocolByName(link.protocol);
        if (props && props.mode) {
            r.mode = props.mode;
        }
        return r;
    }

    function getNodeProperties(node) {
        var r = {};
        for (var n in node._def.defaults) {
            var val = node[n]||"";
            r[n] = val;
        }
        r["rooms"] = node.rooms;
        return r;
    }

    return {
        registerType: registerType,
        expectType: expectType,
        getType: getType,
        getAllTypesOfCategory: getAllTypesOfCategory,
        convertNode: convertNode,
        getLinkAttr: getLinkAttr,
        canBeLinked:  canBeLinked,
        canBeLinkedWith : canBeLinkedWith,
        getDistance : getDistance,
        canAddNode : canAddNode,
        addNode: addNode,
        addLink: addLink,
        remove: removeNode,
        removeLink: removeLink,
        addWorkspace: addWorkspace,
        removeWorkspace: removeWorkspace,
        workspace: getWorkspace,
        defaultWorkspace: defaultWorkspace,
        removeAll:removeAll,
        eachNode: function(cb) {
            for (var n in nodes) {
                cb(nodes[n]);
            }
        },
        eachLink: function(cb) {
            for (var l in links) {
                cb(links[l]);
            }
        },
        node: getNode,
        findNode: findNode,
        findLink: findLink,
        importNodes: importNodes,
        refreshValidation: refreshValidation,
        getAllFlowNodes: getAllFlowNodes,
        createExportableNodeSet: createExportableNodeSet,
        createCompleteNodeSet: createCompleteNodeSet,
        getLinkProperties : getLinkProperties,
        getNodeProperties : getNodeProperties,
        nodes: nodes, // TODO: exposed for d3 vis
        links: links,  // TODO: exposed for d3 vis
        NODE_HEIGHT: NODE_HEIGHT,
        NODE_WIDTH: NODE_WIDTH,
    };
}();
