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
RED.editor = function() {
    var editing_node = null;
    // TODO: should IMPORT/EXPORT get their own dialogs?

    function getCredentialsURL(nodeType, nodeID) {
        var dashedType = nodeType.replace(/\s+/g, '-');
        return  'credentials/' + dashedType + "/" + nodeID;
    }

    function sendCredentials(node,credDefinition,prefix) {
        var credentials = {};
        for (var cred in credDefinition) {
            var input = $("#" + prefix + '-' + cred);
            var value = input.val();
            if (credDefinition[cred].type == 'password' && value == '__PWRD__') {
                continue;
            }
            credentials[cred] = value;
        }
        node._def._creds = credentials;
        $.ajax({
            url: getCredentialsURL(node.type, node.id),
            type: 'POST',
            data: credentials,
            success: function (result) {
            }
        });
    }


    /**
     * Validate a node 
     * @param node - the node being validated
     * @returns {boolean} whether the node is valid. Sets node.dirty if needed
     */
    function validateNodeLink(node) {
        var oldValue = node.valid;
        node.valid = validateNodeLinkProperties(node, node._def.defaults, node);
        if (node.valid && node._def.validate) {
            node.valid = node._def.validate.call(node);
        }
        if (node.valid && node._def._creds) {
            node.valid = validateNodeLinkProperties(node, node._def.credentials, node._def._creds);
        }
        if (oldValue != node.valid) {
            node.dirty = true;
        }
    }

    /**
     * Validate a node's properties for the given set of property definitions
     * @param node/link - the node/link being validated
     * @param definition - the node property definitions (either def.defaults or def.creds)
     * @param properties - the node property values to validate
     * @returns {boolean} whether the node's properties are valid
     */
    function validateNodeLinkProperties(node, definition, properties) {
        for (var prop in definition) {
            if (!validateNodeLinkProperty(node, definition, prop, properties[prop])) {
                return false;
            }
        }
        return true;
    }

    /**
     * Validate a individual node/link property
     * @param nodelink - the node/link being validated
     * @param definition - the node property definitions (either def.defaults or def.creds)
     * @param property - the property name being validated
     * @param value - the property value being validated
     * @returns {boolean} whether the node proprty is valid
     */
    function validateNodeLinkProperty(nodelink,definition,property,value) {
        var valid = true;
        if (typeof value == "string") {
            value = value.trim();
        }
        if (value === "" || value === undefined) { // empty?
            valid = !definition[property].required;
        }
        else if ("validate" in definition[property]) {
            valid = definition[property].validate.call(nodelink,value);
        }

        if (valid && definition[property].type && RED.nodes.getType(definition[property].type) && !("validate" in definition[property])) {
            if (!value || value == "_ADD_") {
                valid = false;
            } else {
                try {
                    var v = RED.nodes.node(value).valid;
                    valid = (v==null || v);
                } catch(err) {
                    valid = false;
                }
            }
        }

        return valid;
    }

    /**
     * Called when the node's properties have changed.
     * Marks the node as dirty and needing a size check.
     * Removes any links to non-existant outputs.
     * @param node - the node that has been updated
     * @returns {array} the links that were removed due to this update
     */
    function updateNodeProperties(node) {
        node.resize = true;
        node.dirty = true;
        var removedLinks = [];
        if (node.ports) {
            if (node.outputs < node.ports.length) {
                while (node.outputs < node.ports.length) {
                    node.ports.pop();
                }
                var removedLinks = [];
                RED.nodes.eachLink(function(l) {
                    if (l.source === node && l.sourcePort >= node.outputs) {
                        removedLinks.push(l);
                    }
                });
                for (var l in removedLinks) {
                    RED.nodes.removeLink(removedLinks[l]);
                }
            } else if (node.outputs > node.ports.length) {
                while (node.outputs > node.ports.length) {
                    node.ports.push(node.ports.length);
                }
            }
        }
        return removedLinks;
    }

    $( "#dialog" ).dialog({
            modal: true,
            autoOpen: false,
            closeOnEscape: false,
            width: 700,
            buttons: [
                {
                    text: "Ok",
                    click: function() {
                        if (editing_node && editing_node.type !== "link") {
                            var changes = {};
                            var changed = false;
                            var wasDirty = RED.view.dirty();

                            if (editing_node._def.oneditsave) {
                                var oldValues = {};
                                for (var d in editing_node._def.defaults) {
                                    if (typeof editing_node[d] === "string" || typeof editing_node[d] === "number") {
                                        oldValues[d] = editing_node[d];
                                    } else {
                                        oldValues[d] = $.extend(true,{},{v:editing_node[d]}).v;
                                    }
                                }
                                var rc = editing_node._def.oneditsave.call(editing_node);
                                if (rc === true) {
                                    changed = true;
                                }

                                for (var d in editing_node._def.defaults) {
                                    if (oldValues[d] === null || typeof oldValues[d] === "string" || typeof oldValues[d] === "number") {
                                        if (oldValues[d] !== editing_node[d]) {
                                            changes[d] = oldValues[d];
                                            changed = true;
                                        }
                                    } else {
                                        if (JSON.stringify(oldValues[d]) !== JSON.stringify(editing_node[d])) {
                                            changes[d] = oldValues[d];
                                            changed = true;
                                        }
                                    }
                                }
                            }

                            if (editing_node._def.defaults) {
                                for (var d in editing_node._def.defaults) {
                                    var input = $("#node-input-"+d);
                                    var newValue;
                                    if (input.attr('type') === "checkbox") {
                                        newValue = input.prop('checked');
                                    } else {
                                        newValue = input.val();
                                        if (newValue === "other" && input.is("select")) {
                                            newValue = "";
                                        }
                                        else if (typeof newValue == "string") {
                                            newValue = newValue.trim();
                                        }
                                    }
                                    if (newValue != null) {
                                        if (editing_node[d] != newValue) {
                                            if (editing_node._def.defaults[d].type) {
                                                if (newValue == "_ADD_") {
                                                    newValue = "";
                                                }
                                                // Change to a related config node
                                                var configNode = RED.nodes.node(editing_node[d]);
                                                if (configNode) {
                                                    var users = configNode.users;
                                                    users.splice(users.indexOf(editing_node),1);
                                                }
                                                configNode = RED.nodes.node(newValue);
                                                if (configNode) {
                                                    configNode.users.push(editing_node);
                                                }
                                            }

                                            changes[d] = editing_node[d];
                                            editing_node[d] = newValue;
                                            changed = true;
                                        }
                                    }
                                }
                            }
                            if (editing_node._def.credentials) {
                                var prefix = 'node-input';
                                var credDefinition = editing_node._def.credentials;
                                sendCredentials(editing_node,credDefinition,prefix);
                            }

                            var removedLinks = updateNodeProperties(editing_node);
                            if (changed) {
                                var wasChanged = editing_node.changed;
                                editing_node.changed = true;
                                RED.view.dirty(true);
                            }
                            validateNodeLink(editing_node);
                            RED.view.redraw();
                        }
                        else if (editing_node && editing_node.type === "link") {

                            var changes = {};
                            var changed = false;
                            var wasDirty = RED.view.dirty();

                            if (editing_node._def.oneditsave) {
                                var rc = editing_node._def.oneditsave.call(editing_node);
                                if (rc === true) {
                                    changed = true;
                                }
                            }

                            if (editing_node._def.defaults) {
                                for (var d in editing_node._def.defaults) {
                                    var input = $("#link-input-"+d);
                                    var newValue;
                                    if (input.attr('type') === "checkbox") {
                                        newValue = input.prop('checked');
                                    } else {
                                        newValue = input.val();
                                        if (newValue === "other" && input.is("select")) {
                                            newValue = "";
                                        }
                                    }
                                    if (newValue != null) {
                                        if (editing_node[d] != newValue) {
                                            changes[d] = editing_node[d];
                                            editing_node[d] = newValue;
                                            changed = true;
                                        }
                                    }
                                }
                            }

                            if (changed) {
                                var wasChanged = editing_node.changed;
                                editing_node.changed = true;
                                editing_node.dirty = true;
                                RED.view.dirty(true);
                            }
                            validateNodeLink(editing_node);
                            if (!editing_node.valid) {
                                // remove this link
                                RED.nodes.removeLink(editing_node);
                                RED.view.dirty(true);
                            }
                            RED.view.setSelectedLink(null);
                            RED.view.redraw();
                        }
                        else if (RED.view.state() == RED.state.EXPORT) {
                            if (/library/.test($( "#dialog" ).dialog("option","title"))) {
                                //TODO: move this to RED.library
                                var flowName = $("#node-input-filename").val();
                                if (!/^\s*$/.test(flowName)) {
                                    $.post('library/flows/'+flowName,$("#node-input-filename").attr('nodes'),function() {
                                            RED.library.loadFlowLibrary();
                                            RED.notify("Saved nodes","success");
                                    });
                                }
                            }
                        } else if (RED.view.state() == RED.state.IMPORT) {
                            RED.view.importNodes($("#node-input-import").val());
                        }
                        $( this ).dialog( "close" );
                    }
                },
                {
                    text: "Cancel",
                    click: function() {
                        if (editing_node && editing_node.type === "link") {
                            validateNodeLink(editing_node);
                            if (!editing_node.valid) {
                                // remove this link
                                RED.nodes.removeLink(editing_node);
                                RED.view.dirty(true);
                                RED.view.setSelectedLink(null);
                                RED.view.redraw();
                            }
                        }
                        $( this ).dialog( "close" );
                    }
                }
            ],
            resize: function(e,ui) {
                if (editing_node) {
                    $(this).dialog('option',"sizeCache-"+editing_node.type,ui.size);
                }
            },
            open: function(e) {
                RED.keyboard.disable();
                if (editing_node) {
                    var size = $(this).dialog('option','sizeCache-'+editing_node.type);
                    if (size) {
                        $(this).dialog('option','width',size.width);
                        $(this).dialog('option','height',size.height);
                    }

                }
            },
            close: function(e) {
                RED.keyboard.enable();

                if (RED.view.state() != RED.state.IMPORT_DRAGGING) {
                    RED.view.state(RED.state.DEFAULT);
                }
                $( this ).dialog('option','height','auto');
                $( this ).dialog('option','width','700');
                if (editing_node) {
                    RED.sidebar.info.refreshNode(editing_node);
                }
//                RED.sidebar.config.refresh();
                editing_node = null;
            }
    });

    /**
     * Create a config-node select box for this property
     * @param node - the node being edited
     * @param property - the name of the field
     * @param type - the type of the config-node
     */
    function prepareConfigNodeSelect(node,property,type) {
        var input = $("#node-input-"+property);
        var node_def = RED.nodes.getType(type);

        input.replaceWith('<select style="width: 60%;" id="node-input-'+property+'"></select>');
        updateConfigNodeSelect(property,type,node[property]);
        var select = $("#node-input-"+property);
        select.after(' <a id="node-input-lookup-'+property+'" class="btn"><i class="icon icon-pencil"></i></a>');
        $('#node-input-lookup-'+property).click(function(e) {
            showEditConfigNodeDialog(property,type,select.find(":selected").val());
            e.preventDefault();
        });
        var label = "";
        var configNode = RED.nodes.node(node[property]);
        if (configNode && node_def.label) {
            if (typeof node_def.label == "function") {
                label = node_def.label.call(configNode);
            } else {
                label = node_def.label;
            }
        }
        input.val(label);
    }

    /**
     * Populate the editor dialog input field for this property
     * @param nodelink - the node or node being edited
     * @param property - the name of the field
     * @param prefix - the prefix to use in the input element ids (node-input|node-config-input)
     */
    function preparePropertyEditor(nodelink,property,prefix) {
        var input = $("#"+prefix+"-"+property);
        if (input.attr('type') === "checkbox") {
            input.prop('checked',nodelink[property]);
        } else {
            var val = nodelink[property];
            if (val == null) {
                val = "";
            }
            input.val(val);
        }
    }

    /**
     * Add an on-change handler to revalidate a node field
     * @param nodelink - the node/link being edited
     * @param definition - the definition of the node
     * @param property - the name of the field
     * @param prefix - the prefix to use in the input element ids (node-input|node-config-input)
     */
    function attachPropertyChangeHandler(nodelink,definition,property,prefix) {
        $("#"+prefix+"-"+property).change(function() {
            if (!validateNodeLinkProperty(nodelink, definition, property,this.value)) {
                $(this).addClass("input-error");
            } else {
                $(this).removeClass("input-error");
            }
        });
    }

    /**
     * Prepare all of the editor dialog fields
     * @param node - the node being edited
     * @param definition - the node definition
     * @param prefix - the prefix to use in the input element ids (node-input|node-config-input)
     */
    function prepareEditDialog(node,definition,prefix,showStatus) {
        for (var d in definition.defaults) {
            if (definition.defaults[d].type) {
                prepareConfigNodeSelect(node,d,definition.defaults[d].type);
            } else {
                preparePropertyEditor(node,d,prefix);
            }
            attachPropertyChangeHandler(node,definition.defaults,d,prefix);
        }
        if (definition.credentials) {

            $.getJSON(getCredentialsURL(node.type, node.id), function (data) {
                for (var cred in definition.credentials) {
                    if (definition.credentials[cred].type == 'password') {
                        if (data['has' + cred]) {
                            $('#' + prefix + '-' + cred).val('__PWRD__');
                        }
                        else {
                            $('#' + prefix + '-' + cred).val('');
                        }
                    } else {
                        preparePropertyEditor(data, cred, prefix);
                    }
                    attachPropertyChangeHandler(node, definition.credentials, cred, prefix);
                    for (var cred in definition.credentials) {
                        $("#" + prefix + "-" + cred).change();
                    }
                }
            });
        }
        if (definition.oneditprepare) {
            node._editing_node = editing_node; // hack
            definition.oneditprepare.call(node);
            delete node._editing_node;
        }
        for (var d in definition.defaults) {
            $("#"+prefix+"-"+d).change();
        }
    }

    function prepareDialogVisuals(script, tabScript) {
        if (script.attr("width")) $("#dialog").dialog('option','width',script.attr("width"));
        if (script.attr("height")) $("#dialog").dialog('option','height',script.attr("height"));
        $("#dialog-form").html(script.html());

        if (tabScript) $("#dialog-tab-main", "#dialog-form").html(tabScript.html());

        // enable tab functionality, if present in the dialog
        $('.dialog-tab-label').on('click', function(e)  {
            var currentAttrValue = $(this).attr('href');
            $('.dialog-tabs ' + currentAttrValue).show().siblings().hide();
            $(this).parent('li').addClass('active').siblings().removeClass('active');
            e.preventDefault();
        });
    }

    function showEditDialog(node) {
        editing_node = node;
        RED.view.state(RED.state.EDITING);

        var wholeScript = $("script[data-template-name='task-tabbed-dialog']");

        // use type-specific dialog tab
        var script = $("script[data-template-name='task-" + node.type + "-dialog-tab']");
        if (script && script.html()) {
            prepareDialogVisuals(wholeScript, script);
        }
        else {
            // use type-specific dialog
            script = $("script[data-template-name='" + node.type + "']");
            if (script && script.html()) {
                prepareDialogVisuals(script);
            } else {
                // use category-specific dialog tab
                script = $("script[data-template-name='task-" + node._def.category + "-dialog-tab']");
                if (script && script.html()) {
                    prepareDialogVisuals(wholeScript, script);
                }
                else {
                    // use category-specific whole dialog 
                    script = $("script[data-template-name='task-" + node._def.category + "-dialog']");
                    if (!script || !script.html()) {
                        // use default task-edit dialog
                        script = $("script[data-template-name='task-default-dialog']");
                    }
                    prepareDialogVisuals(script);
                }
            }
        }

        prepareEditDialog(node,node._def,"node-input",true);
        var title = "Edit " + node.type + " node";
        $( "#dialog" ).dialog("option","title",title).dialog( "open" );
    }

    function showEditLinkDialog(link) {
        editing_node = link;
        RED.view.state(RED.state.EDITING_LINK);

        prepareDialogVisuals($("script[data-template-name='link-dialog']"));

        var distance = RED.nodes.getDistance(link.source, link.target);

        var protocol = $( "#link-input-protocol" );
        var options = [];
        var optionsDisabled = [];
        RED.options.getProtocols().forEach(function(p) {
            var key = p.nm;
            var value = p.name;
            // check if both the source and target has this technology
            if (RED.nodes.canBeLinkedWith(link.source, link.target, key)) {
                var d = "", d2 = "";
                if (distance > p.range) {
                    // out of range for this protocol
                    optionsDisabled.push('<option value="' + key + '" disabled="disabled">' + value + ' (out of range)</option>');
                } else {
                    options.push('<option value="' + key + '">' + value + '</option>');
                }
            }
        });

        // append all active select options
        protocol.empty().append(options.join("") + optionsDisabled.join(""));

        // this will hopefully select the right option for protocol
        prepareEditDialog(link,link._def,"link-input", true);

        var title = "Edit link from " + getValue(link.source._def.label, link.source)
            + " to " + getValue(link.target._def.label, link.target);
        $( "#dialog" ).dialog("option","title",title).dialog( "open" );
    }

    function showEditConfigNodeDialog(name,type,id) {
        var adding = (id == "_ADD_");
        var node_def = RED.nodes.getType(type);

        var configNode = RED.nodes.node(id);
        if (configNode == null) {
            configNode = {
                id: getRandomID(),
                _def: node_def,
                type: type
            }
            for (var d in node_def.defaults) {
                if (node_def.defaults[d].value) {
                    configNode[d] = node_def.defaults[d].value;
                }
            }
        }

        $("#dialog-config-form").html($("script[data-template-name='"+type+"']").html());
        prepareEditDialog(configNode,node_def,"node-config-input",false);

        var buttons = $("#node-config-dialog").dialog("option","buttons");
        if (adding) {
            if (buttons.length == 3) {
                buttons = buttons.splice(1);
            }
            buttons[0].text = "Add";
            $("#node-config-dialog-user-count").html("").hide();
        } else {
            if (buttons.length == 2) {
                buttons.unshift({
                        class: 'leftButton',
                        text: "Delete",
                        click: function() {
                            var configProperty = $(this).dialog('option','node-property');
                            var configId = $(this).dialog('option','node-id');
                            var configType = $(this).dialog('option','node-type');
                            var configNode = RED.nodes.node(configId);
                            var configTypeDef = RED.nodes.getType(configType);

                            if (configTypeDef.credentials) {
                                $.ajax({
                                    url: getCredentialsURL(configType, configId),
                                    type: 'DELETE',
                                    success: function (result) {
                                    }
                                });
                            }
                            if (configTypeDef.ondelete) {
                                configTypeDef.ondelete.call(RED.nodes.node(configId));
                            }
                            RED.nodes.remove(configId);
                            for (var i in configNode.users) {
                                var user = configNode.users[i];
                                for (var d in user._def.defaults) {
                                    if (user[d] == configId) {
                                        user[d] = "";
                                    }
                                }
                                validateNodeLink(user);
                            }
                            updateConfigNodeSelect(configProperty,configType,"");
                            RED.view.dirty(true);
                            $( this ).dialog( "close" );
                            RED.view.redraw();
                        }
                });
            }
            buttons[1].text = "Update";
            $("#node-config-dialog-user-count").html(configNode.users.length+" node"+(configNode.users.length==1?" uses":"s use")+" this config").show();
        }
        $( "#node-config-dialog" ).dialog("option","buttons",buttons);

        $( "#node-config-dialog" )
            .dialog("option","node-adding",adding)
            .dialog("option","node-property",name)
            .dialog("option","node-id",configNode.id)
            .dialog("option","node-type",type)
            .dialog("option","title",(adding?"Add new ":"Edit ")+type+" config node")
            .dialog( "open" );
    }

    function updateConfigNodeSelect(name,type,value) {
        var select = $("#node-input-"+name);
        var node_def = RED.nodes.getType(type);
        select.children().remove();
        RED.nodes.eachConfig(function(config) {
            if (config.type == type) {
                var label = "";
                if (typeof node_def.label == "function") {
                    label = node_def.label.call(config);
                } else {
                    label = node_def.label;
                }
                select.append('<option value="'+config.id+'"'+(value==config.id?" selected":"")+'>'+label+'</option>');
            }
        });

        select.append('<option value="_ADD_"'+(value==""?" selected":"")+'>Add new '+type+'...</option>');
        window.setTimeout(function() { select.change();},50);
    }

    $( "#node-config-dialog" ).dialog({
            modal: true,
            autoOpen: false,
            width: 500,
            closeOnEscape: false,
            buttons: [
                {
                    text: "Ok",
                    click: function() {
                        var configProperty = $(this).dialog('option','node-property');
                        var configId = $(this).dialog('option','node-id');
                        var configType = $(this).dialog('option','node-type');
                        var configAdding = $(this).dialog('option','node-adding');
                        var configTypeDef = RED.nodes.getType(configType);
                        var configNode;

                        if (configAdding) {
                            configNode = {type:configType,id:configId,users:[]};
                            for (var d in configTypeDef.defaults) {
                                var input = $("#node-config-input-"+d);
                                configNode[d] = input.val();
                            }
                            configNode.label = configTypeDef.label;
                            configNode._def = configTypeDef;
                            RED.nodes.addNode(configNode);
                            updateConfigNodeSelect(configProperty,configType,configNode.id);
                        } else {
                            configNode = RED.nodes.node(configId);
                            for (var d in configTypeDef.defaults) {
                                var input = $("#node-config-input-"+d);
                                configNode[d] = input.val();
                            }
                            updateConfigNodeSelect(configProperty,configType,configId);
                        }
                        if (configTypeDef.credentials) {
                            sendCredentials(configNode,configTypeDef.credentials,"node-config-input");
                        }
                        if (configTypeDef.oneditsave) {
                            configTypeDef.oneditsave.call(RED.nodes.node(configId));
                        }
                        validateNodeLink(configNode);

                        for (var i in configNode.users) {
                            var user = configNode.users[i];
                            if (!configNode.valid) {
                                // TODO: this is probably not the only place
                                // where user node validity tracking should be improved 
                                user.valid = false;
                            }
                            // redraw it; e.g. in case color changed
                            user.dirty = true;
                            user.changed = true; // XXX: this is wrong but...
                        }

                        RED.view.dirty(true);
                        $(this).dialog("close");

                    }
                },
                {
                    text: "Cancel",
                    click: function() {
                        var configType = $(this).dialog('option','node-type');
                        var configId = $(this).dialog('option','node-id');
                        var configAdding = $(this).dialog('option','node-adding');
                        var configTypeDef = RED.nodes.getType(configType);

                        if (configTypeDef.oneditcancel) {
                            // TODO: what to pass as this to call
                            if (configTypeDef.oneditcancel) {
                                var cn = RED.nodes.node(configId);
                                if (cn) {
                                    configTypeDef.oneditcancel.call(cn,false);
                                } else {
                                    configTypeDef.oneditcancel.call({id:configId},true);
                                }
                            }
                        }
                        $( this ).dialog( "close" );
                    }
                }
            ],
            resize: function(e,ui) {
            },
            open: function(e) {
                if (RED.view.state() != RED.state.EDITING) {
                    RED.keyboard.disable();
                }
            },
            close: function(e) {
                $("#dialog-config-form").html("");
                if (RED.view.state() != RED.state.EDITING) {
                    RED.keyboard.enable();
                }
//                RED.sidebar.config.refresh();
            }
    });

    $('#btn-background-clear')
        .on("click",function(e) {
            RED.view.showImportedBackground(null);
        });
    $('#btn-background-set')
        .on("click",function(e) {
            var file = $( '#background-input-filename' ).val();
            if (!file || file.length == 0) {
                // event.stopPropagation();
                e.preventDefault();
                RED.notify("Background image file not selected!", "error");
            }
        });

    $( "#import-background-dialog" ).dialog({
        modal: true,
        autoOpen: false,
        width: 600
    });


    return {
        edit: showEditDialog,
        editLink: showEditLinkDialog,
        editConfig: showEditConfigNodeDialog,
        validateNode: validateNodeLink,
        updateNodeProperties: updateNodeProperties // TODO: only exposed for edit-undo
    }
}();
