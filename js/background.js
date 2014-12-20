chrome.runtime.onStartup.addListener(initOnStartup);
chrome.runtime.onMessage.addListener(callAPI);

// var apiRoot  = 'http://fbcredibility.com:8080/';
var apiRoot  = 'http://127.0.0.1:9090/';

var xhrF, xhrC = [];

function initOnStartup() {
	console.log('3');
	chrome.storage.local.clear();

	setInterval(function() { chrome.storage.local.clear(); }, (15*60*1000));
}

function callAPI(request, sender, sendResponse) {
	if (request.action == 'fetch_credibility') {
		// console.log(request.para);
		var xhr = new XMLHttpRequest();
		// xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
		var url = apiRoot+'j1fbfilterel?return_id='+request.return_id+"&likes="+request.likes;
		xhr.open("POST", url, false);
		xhr.onreadystatechange = function() {
			var response = {ret_id:'', description:'', status:''};
			console.log('r1');
			console.log(xhr.responseText);
			var fbres = JSON.parse(xhr.responseText);
			response.ret_id = fbres.return_id;
			response.description = fbres.description;
			response.status = fbres.status;
			try {
				sendResponse(response);
			} catch(err) { 
				console.log("Couldn't send response: ", err); 
			}			
		}

		try { 
			xhr.send(null);
		} catch(err) { 
			console.log("Couldn't send XMLHttpRequest: ", err); 
		}
	}
}