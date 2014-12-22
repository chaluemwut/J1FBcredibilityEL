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
		// console.log('before');
		// console.log(request.fbpost);
		var xhr = new XMLHttpRequest();
		var url = apiRoot+'j1fbfilterel?return_id='+request.fbpost.return_id+"&likes="+request.fbpost.likes+
		'&comments='+request.fbpost.comments+'&url='+request.fbpost.url+'&hashtag='+request.fbpost.hashtag+
		'&images='+request.fbpost.images+'&vdo='+request.fbpost.vdo+'&location='+request.fbpost.location
		+'&non_location='+request.fbpost.non_location
		+'&is_public='+request.fbpost.is_public
		+'&share_only_friend='+request.fbpost.share_only_friend
		+'&app_sender='+request.fbpost.app_sender
		+'&feeling_status='+request.fbpost.feeling_status
		+'&tag_with='+request.fbpost.tag_with
		+'&message='+request.fbpost.message;
		console.log('location : '+request.fbpost.location);
		xhr.open("POST", url, false);
		xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
		xhr.onreadystatechange = function() {
			var response = {ret_id:'', description:'', status:''};
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