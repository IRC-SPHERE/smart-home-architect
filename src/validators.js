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

RED.validators = {
    number: function(){return function(v) {
        return isFinite(v)
    }},
    positiveNumber: function(){return function(v) {
        return isFinite(v) && v > 0
    }},
    nonNegNumber: function(){return function(v) {
        return isFinite(v) && v >= 0
    }},
    integer: function(){return function(v) {
        return isFinite(v) && v%1 === 0
    }},
    positiveInteger: function(){return function(v) {
        return isFinite(v) && v > 0 && v%1 === 0
    }},
    nonNegInteger: function(){return function(v) {
        return isFinite(v) && v >= 0 && v%1 === 0
    }},
    regex: function(re){return function(v) { return re.test(v)}},

    id: function(){return function(v) {
        return RED.nodes.node(v) ? true : false
    }},
    idList: function(){return function(v) {
        return v.split(",").reduce(function(acc, curr) {
            if (acc) acc = RED.nodes.node(curr.trim()) ? true : false;
            return acc;
        }, true);
    }},
};
