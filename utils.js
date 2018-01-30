/**
 * Copyright 2017 University of Bristol
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

function includes(a, o) {
    return a.indexOf(o) !== -1;
}

if (typeof String.prototype.includes != 'function') {
    String.prototype.includes = function(x)
    {
        return this.indexOf(x) !== -1;
    };
}

if(typeof(String.prototype.trim) === "undefined") {
    String.prototype.trim = function() 
    {
        return String(this).replace(/^\s+|\s+$/g, '');
    };
}

if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function(str) {
      return this.indexOf(str) == 0;
  };
}
if (typeof String.prototype.endsWith != 'function') {
    String.prototype.endsWith = function(pattern) {
        var d = this.length - pattern.length;
        return d >= 0 && this.lastIndexOf(pattern) === d;
    };
}
function basename(path) {
    return path.split(/[\\/]/).pop();
}
function split(val) {
    return val.split(/,\s*/);
}
function extractLast(term) {
    return split(term).pop();
}
function trimComma( val ) {
    return val.trim().replace(/,$/g, '');
}
function oc(a)
{
  var o = {};
  for (var i = 0; i < a.length; i++) {
    o[a[i]] = '';
  }
  return o;
}
function floatEqual(x, y) {
	return Math.abs(x - y) < 0.000001;
}

function getValue(x, arg) {
    if (x === null || x === undefined) return "";
    return (typeof x === "function") ? x.call(arg) : x;
}

function findInArray(arr, predicate) {
    for (var i = 0; i < arr.length; i++) {
        if (predicate(arr[i])) return arr[i];
    }
    return null;
}
function getRandomID() {
    return (1+Math.random()*4294967295).toString(16);
}
// allow to save Object values in local storage
Storage.prototype.setObject = function(key, value) {
    this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function(key) {
    var value = this.getItem(key);
    return value && JSON.parse(value);
}

window.GetQueryString = function(q) {
    return (function(a) {
        if (a == "") return {};
        var b = {};
        for (var i = 0; i < a.length; ++i) {
            var p = a[i].split('=');
            if (p.length != 2) continue;
            b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
        }
        return b;
    })(q.split("&"));
};

function propertiesToObject(props)
{
    var result = {};
    if (props) {
        var parts = props.split(",");
        parts.forEach(function (p) {
            var nameValue = p.split(":").map(function (s) {return s.trim() });
            if (nameValue.length == 1) {
                result[nameValue[0]] = true; // default value
            } else if (nameValue.length > 0) {
                var val = nameValue[1];
                if (/^\d+$/.test(val)) {
                    result[nameValue[0]] = parseInt(val);
                } else {
                    result[nameValue[0]] = val;
                }
            }
        });
    }
    return result;
}

function jsonFilter(key,value) {
    if (key == "") {
        return value;
    }
    var t = typeof value;
    if ($.isArray(value)) {
        return "[array:"+value.length+"]";
    } else if (t === "object") {
        return "[object]"
//    } else if (t === "string") {
//        if (value.length > 30) {
//            return value.substring(0,30)+" ...";
//        }
    }
    return value;
}

function getPropertyForDisplay(name, arg)
{
    var val = arg||"";
    var type = typeof val;
    if (type === "string") {
        //val = val.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    } else if (type === "number") {
        val = val.toString();
    } else if ($.isArray(val)) {
        val = "[";
        for (var i=0;i<Math.min(arg.length,10);i++) {
            var vv = JSON.stringify(arg[i],jsonFilter," "); //.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
            val += "&nbsp;"+i+": "+vv;
        }
        if (arg.length > 10) {
            val += "&nbsp;... "+arg.length+" items";
        }
        val += "]";
    } else {
        val = JSON.stringify(val,jsonFilter," ");
        //val = val.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }

    // cut it if too long
    if (name.length + val.length > 35) { 
        val = ((name.length > 32) ? "" : val.substring(0,32-name.length)) + "...";
    }
    return val;
}

function getPropertiesForDisplay(d)
{
    var props = [];
    for (var n in d._def.defaults) {
        if (d[n] === undefined || d[n] === null || d[n] == d._def.defaults[n].value) continue;

        if (!d._def.defaults[n].hidden) {
            var name = n == "properties" ? "" : n; // don't show the name "properties"
            props.push({name:name, value:getPropertyForDisplay(name, d[n])});
        }
    }

    return props;
}


// autocomplete that works with list of values
function singleAutocomplete(selector, array)
{
    selector
        .bind("keydown", function(event) {
            if (event.keyCode === $.ui.keyCode.TAB) {
                // $(this).autocomplete("search", ".");
                // $(this).trigger("focus");
                $(this).autocomplete("search", "");
                event.preventDefault();
            }
        })
        .autocomplete({ minLength: 0, source: array });
}

// autocomplete that works with list of values
function multiAutocomplete(selector, array)
{
    selector
        // don't navigate away from the field on tab when selecting an item
        .bind("keydown", function(event) {
            if (event.keyCode === $.ui.keyCode.TAB) {
                $(this).autocomplete("search", "");
                event.preventDefault();
            }
        })
        .autocomplete({
            minLength: 0,
            source: function(request, response) {
                // delegate back to autocomplete, but extract the last term
                response($.ui.autocomplete.filter(array, extractLast(request.term)));
            },
            focus: function() {
                // prevent value inserted on focus
                return false;

            },
            select: function(event, ui) {
                var terms = split(this.value);
                // remove the current input
                terms.pop();
                // add the selected item
                terms.push(ui.item.value);
                // add placeholder to get the comma-and-space at the end
                terms.push("");
                this.value = terms.join(", ");
                return false;
            }
        });
}
