(function() {
	if (window._JSNativeBridge) {
		return;
	}

    /* java -> js -> js message handlers */
	var messageHandlers = {};

	/* js -> java -> jsCallback */
	var responseCallbacks = {};
	var uniqueId = 1;

    /* js -> java 需要统一编码,解决js传给java的编码格式有问题造成的调用失败,例如Unicode编码 */
    var base64encodechars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function base64encode(str) {
        if (str === undefined) {
            return str;
        }

        var out, i, len;
        var c1, c2, c3;
        len = str.length;
        i = 0;
        out = "";
        while (i < len) {
            c1 = str.charCodeAt(i++) & 0xff;
            if (i == len) {
                out += base64encodechars.charAt(c1 >> 2);
                out += base64encodechars.charAt((c1 & 0x3) << 4);
                out += "==";
                break;
            }
            c2 = str.charCodeAt(i++);
            if (i == len) {
                out += base64encodechars.charAt(c1 >> 2);
                out += base64encodechars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xf0) >> 4));
                out += base64encodechars.charAt((c2 & 0xf) << 2);
                out += "=";
                break;
            }
            c3 = str.charCodeAt(i++);
            out += base64encodechars.charAt(c1 >> 2);
            out += base64encodechars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xf0) >> 4));
            out += base64encodechars.charAt(((c2 & 0xf) << 2) | ((c3 & 0xc0) >> 6));
            out += base64encodechars.charAt(c3 & 0x3f);
        }
        return out;
    }

    var UTF8 = {
        // public method for url encoding
        encode: function(string) {
            string = string.replace(/\r\n/g, "\n");
            var utftext = "";
            for (var n = 0; n < string.length; n++) {
                var c = string.charCodeAt(n);
                if (c < 128) {
                    utftext += String.fromCharCode(c);
                } else if ((c > 127) && (c < 2048)) {
                    utftext += String.fromCharCode((c >> 6) | 192);
                    utftext += String.fromCharCode((c & 63) | 128);
                } else {
                    utftext += String.fromCharCode((c >> 12) | 224);
                    utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
            }

            return utftext;
        },

        // public method for url decoding
        decode: function(utftext) {
            var string = "";
            var i = 0;
            var c = c1 = c2 = 0;
            while (i < utftext.length) {
                c = utftext.charCodeAt(i);
                if (c < 128) {
                    string += String.fromCharCode(c);
                    i++;
                } else if ((c > 191) && (c < 224)) {
                    c2 = utftext.charCodeAt(i + 1);
                    string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                    i += 2;
                } else {
                    c2 = utftext.charCodeAt(i + 1);
                    c3 = utftext.charCodeAt(i + 2);
                    string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                    i += 3;
                }
            }

            return string;
        }
    };

    function _isEmpty(str){
        if(str === null){
            return true;
        }

        if (str.replace(/(^s*)|(s*$)/g, "").length ==0){
            return true;
        }
    }

    /* register js message handlers */
	function _registerHandler(handlerName, handler) {
		messageHandlers[handlerName] = handler;
	}

	/* a1. js -> java 异步 */
	function _doSendRequest(handlerName, params, responseCallback) {
		var callbackId = 'cb_' + (uniqueId++) + '_' + new Date().getTime();
		responseCallbacks[callbackId] = responseCallback;

		var request = {};
		request[_JSNativeBridge.request.interfaceName] = handlerName;
		request[_JSNativeBridge.request.valuesName] = params;
		request[_JSNativeBridge.request.callbackIdName] = callbackId;
		_doSend(request, false);
	}

	/* a1. js -> java 同步 */
    function _doSendRequestSync(handlerName, params) {
    	var request = {};
    	request[_JSNativeBridge.request.interfaceName] = handlerName;
    	request[_JSNativeBridge.request.valuesName] = params;
    	return _doSend(request, true);
    }

	/* a2. js -> java 出口 */
	function _doSend(message, sync) {
	    if(_isEmpty(_JSNativeBridge.protocol.scheme) || _isEmpty(_JSNativeBridge.protocol.host) || _isEmpty(_JSNativeBridge.protocol.port)){
	        throw "_JSNativeBridge.protocol.scheme or host or port should not be null";
	    }

        if(_JSNativeBridge.debug){
            console.log("--- JS PROMPT BEGIN ---");
        }

	    // nim://dispatch:1?{json params}, prompt 是阻塞的,要等待java层confirm调用后才会返回
		var result = prompt(_JSNativeBridge.protocol.scheme + '://'
		        + _JSNativeBridge.protocol.host + ':'
		        + _JSNativeBridge.protocol.port + '?'
		        + base64encode(UTF8.encode(JSON.stringify(message))));

		if(_JSNativeBridge.debug){
		    console.log("--- JS PROMPT END ---" + result);
		}

        if(sync) {
            return JSON.parse(result);
        }
	}

    /* a3. js -> java -> java reply to js -> js ->_doNativeResponse, 即 js -> java, java回复后，js执行回调函数 */
	function _doNativeResponse(response){
		var responseIdValue = response[_JSNativeBridge.response.responseIdName];
		if (responseIdValue) {
			responseCallback = responseCallbacks[responseIdValue];
			if (!responseCallback) {
				alert('responseCallback doesn\'t exist!');
				return;
			}
			responseCallback(response[_JSNativeBridge.response.responseName]);
			/*移除回调接口*/
			delete responseCallbacks[responseIdValue];
			return true;
		}

		return false;
	}


    /* b1. java -> js -> _doNativeRequest -> js messageHandler -> _doSendResponse */
	function _doNativeRequest(request){
		var responseCallback;
		var callbackId = request[_JSNativeBridge.request.callbackIdName];
		/*native的request携带callback id*/
		if (callbackId) {
			responseCallback = function(responseData) {
				_doSendResponse(callbackId,
					responseData || {}
				);
			};
		}

		var handler = _JSNativeBridge._messageHandler;
		var handlerName = request[_JSNativeBridge.request.interfaceName];
		if (handlerName) {
			/*说明js存在这样的接口*/
			if (messageHandlers[handlerName]) {
				handler = messageHandlers[handlerName];
			}else{
				/*否则发送失败的信息*/
				_doSendResponse(callbackId,
				{
					status: "-1",
					msg: "Js can't find correspond method."
				});
			}
		}
		try {
			/*发送*/
			handler(request[_JSNativeBridge.request.valuesName], responseCallback);
		} catch (exception) {
			if (typeof console != 'undefined') {
				alert("_JSNativeBridge: WARNING: javascript handler throw.", message, exception);
			}
		}
	}

	/* b2. java -> js -> _doNativeRequest -> js messageHandler -> _doSendResponse*/
	function _doSendResponse(responseId, responseData){
		var response = {};
		response[_JSNativeBridge.response.responseIdName] = responseId;
		response[_JSNativeBridge.response.responseName] = responseData;

		if(_JSNativeBridge.debug){
            console.log("--- JS RESPONSE TO JAVA ---");
        }

		_doSend(response, false);
	}

	/* java->js 的入口函数: 可能是 java -> js 的 request 数据,也可能 js -> java, java 的 Response 数据 */
	function _handleMessageFromNative(messageJSON) {
	    setTimeout(function() {
        	if(_JSNativeBridge.debug){
                console.log('--- JS RECEIVED JAVA JSON DATA：' + messageJSON + '---');
            }

        	var message = JSON.parse(messageJSON);
        	if(!_doNativeResponse(message)){
        		_doNativeRequest(message);
        	}
        });
	}

    // 全局定义
	var _JSNativeBridge = window._JSNativeBridge = {
		_registerHandler: _registerHandler,
		_doSendRequest: _doSendRequest,
		_doSendRequestSync : _doSendRequestSync,
		_handleMessageFromNative: _handleMessageFromNative,
		request:{
			interfaceName:"handlerName",
			callbackIdName:"callbackId",
			valuesName:"params"
		},
		response:{
			responseIdName:"responseId",
			responseName:"data",
		},
		protocol:{
		    scheme:"nim",
		    host:"dispatch",
		    port:"1",
		},
		debug:true
	};

	if(_JSNativeBridge.debug){
	    console.log("--- load nim_js_native_bridge.js done ---");
	}

	var doc = document;
	var readyEvent = doc.createEvent('Events');
	readyEvent.initEvent('JsBridgeInit');
	readyEvent.bridge = _JSNativeBridge;
	doc.dispatchEvent(readyEvent);
})();
