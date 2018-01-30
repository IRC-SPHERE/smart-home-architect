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
RED.sidebar.info = function() {
    
    var content = document.createElement("div");
    content.id = "tab-info";
    content.style.paddingTop = "4px";
    content.style.paddingLeft = "4px";
    content.style.paddingRight = "4px";

    RED.sidebar.addTab("info",content);
    
    function jsonFilter(key,value) {
        if (key == "") {
            return value;
        }
        var t = typeof value;
        if ($.isArray(value)) {
            return "[array:"+value.length+"]";
        } else if (t === "object") {
            return "[object]"
        } else if (t === "string") {
            if (value.length > 30) {
                return value.substring(0,30)+" ...";
            }
        }
        return value;
    }

    function refreshNodeRooms(node) {
        var val = JSON.stringify(node.rooms, jsonFilter," ") || "";
        val = val.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

        $( "#table-rooms-value").text(val);
    }
    
    function refreshNode(node) {
        var table = '<table class="node-info"><tbody>';

        table += "<tr><td>Type</td><td>&nbsp;"+node.type+"</td></tr>";
        table += '<tr class="blank"><td colspan="2">&nbsp;Properties</td></tr>';
        var prop = RED.nodes.getNodeProperties(node);
        for (var n in prop) {
            var val = prop[n];
            var type = typeof val;
            if (type === "string") {
                if (val.length > 30) { 
                    val = val.substring(0,30)+" ...";
                }
                val = val.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
            } else if (type === "number") {
                val = val.toString();
            } /*else if ($.isArray(val)) {
                val = "[<br/>";
                for (var i=0;i<Math.min(prop[n].length,10);i++) {
                    var vv = JSON.stringify(prop[n][i],jsonFilter," ").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
                    val += "&nbsp;"+i+": "+vv+"<br/>";
                }
                if (prop[n].length > 10) {
                    val += "&nbsp;... "+node[n].length+" items<br/>";
                }
                val += "]";
            } */ else {
                val = JSON.stringify(val,jsonFilter," ") || "";
                val = val.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
            }

            if(n === "rooms") {
                table += '<tr><td>&nbsp;'+n+'</td><td id="table-rooms-value">'+val+'</td></tr>';
            } else {
                table += "<td>&nbsp;"+n+"</td><td>"+val+"</td></tr>";
            }
        }
        table += "</tbody></table><br/>";
        table  += '<div class="node-help">'+($("script[data-help-name|='"+node.type+"']").html()||"")+"</div>";
        $("#tab-info").html(table);
    }

    function refreshLink(link) {
        var table = '<table class="node-info"><tbody>';

        table += "<tr><td>Type</td><td>&nbsp;link</td></tr>";
        table += '<tr class="blank"><td colspan="2">&nbsp;Properties</td></tr>';
        var prop = RED.nodes.getLinkProperties(link);
        for (var n in prop) {
            var val = prop[n];
            var type = typeof val;
            if (type === "string") {
                if (val.length > 30) { 
                    val = val.substring(0,30)+" ...";
                }
                val = val.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
            } else if (type === "number") {
                val = val.toString();
            } else if ($.isArray(val)) {
                val = "[<br/>";
                for (var i=0;i<Math.min(prop[n].length,10);i++) {
                    var vv = JSON.stringify(prop[n][i],jsonFilter," ").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
                    val += "&nbsp;"+i+": "+vv+"<br/>";
                }
                if (prop[n].length > 10) {
                    val += "&nbsp;... "+prop[n].length+" items<br/>";
                }
                val += "]";
            } else {
                val = JSON.stringify(val,jsonFilter," ");
                val = val.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
            }
            
            table += "<tr><td>&nbsp;"+n+"</td><td>"+val+"</td></tr>";
        }
        table += "</tbody></table><br/>";

        var props = RED.options.getProtocolByName(link.protocol);
        table += '<div class="node-help">' + (props && props.description ? props.description : "") + "</div>";
        $("#tab-info").html(table);
    }

    function clear() {
        // show a suggestion instead
        var suggestion = RED.suggestions.get();
        var text;
        if (suggestion.type === "Problem") {
            text = "<strong>Problem: </strong>" + suggestion.text;
        } else {
            text = "<i>Suggestion: </i>" + suggestion.text + ".";
        }
        if (text[text.length - 1] !== '!' && text[text.length - 1] !== '.') {
            text += '.';
        }
        $("#tab-info").html('<div class="node-suggestion">' + text + '</div>');
    }
   
    return {
        refreshNode:refreshNode,
        refreshNodeRooms:refreshNodeRooms,
        refreshLink:refreshLink,
        clear:  clear
    }
}();
