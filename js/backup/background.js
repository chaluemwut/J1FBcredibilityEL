chrome.runtime.onStartup.addListener(initOnStartup);
chrome.runtime.onMessage.addListener(showPageAction);
chrome.runtime.onMessage.addListener(fetchTweetCredibility);
// chrome.runtime.onMessage.addListener(sendCredibilityFeedback);

// console.log('1');
// chrome.pageAction.onClicked.addListener(function(activeTab) {
// 	console.log('2');
// 	chrome.tabs.create({url: 'http://twitdigest.iiitd.edu.in/TweetCred/feedback.html'});
// });

var apiToken = '9fa8d0c2d880ffb498f83506748f7682';
var apiRoot  = 'http://precog.iiitd.edu.in/tools/spzf/twitdigestserver/twit-digest-plugin/api/';

var xhrF, xhrC = [];

function initOnStartup() {
	console.log('3');
	chrome.storage.local.clear();

	setInterval(function() { chrome.storage.local.clear(); }, (15*60*1000));
}

function showPageAction(request, sender) {
	if (request.action == 'show_page_action') {
		console.log('4'+sender.tab.id);
		chrome.pageAction.show(sender.tab.id);
	}
}

function fetchTweetCredibility(request, sender, sendResponse) {
	if (request.action == 'fetch_credibility') {
		console.log('5');
		var response = {credibilities: []}, statusArr = [], xhrC = [], xhrF;

		var count = 0;

		var responseURL = apiRoot+'index.php/credibility';

		var senderId = request.sender_id;

		console.log("Fetching credibilities for tweets: ", request.batch);

		xhrF = new XMLHttpRequest();
		xhrF.open("POST", apiRoot+'index.php/checkfeedbacks', true);
		xhrF.onreadystatechange = function() {
			if (xhrF.readyState == 4) {
				console.log("Got feedback status: ", xhrF.responseText);

				if (xhrF.status == 200) {
					feedbacks = JSON.parse(xhrF.responseText);

					for (var i = 0; i < feedbacks.length; i++) {
						var feedbackData = feedbacks[i];

						var feedbackObject = {};
						feedbackObject['feedback_'+feedbackData.status_id] = feedbackData.feedback_exists;
						chrome.storage.local.set(feedbackObject);
					}
				} else {
					for (var i = 0; i < request.batch.length; i++) {
						var feedbackObject = {};
						feedbackObject['feedback_'+request.batch[i].tweet.id] = false;
						chrome.storage.local.set(feedbackObject);
					}
				}

				try { sendResponse(response); }
				catch(err) { console.log("Couldn't send response: ", err); }
			}
		}

		for (var i = 0; i < request.batch.length; i++)
			statusArr.push(request.batch[i].tweet.id);

		for (var i = 0; i < request.batch.length; i++) {
			if (request.batch[i].tweet.id !== undefined) {
				(function(idx) {
					xhrC.push(new XMLHttpRequest());
					xhrC[idx].open("GET", responseURL+'/'+request.batch[idx].tweet.id+'?token='+apiToken+'&senderId='+senderId, true);
					xhrC[idx].onreadystatechange = function() {
						if (xhrC[idx].readyState == 4) {
							if (xhrC[idx].status == 200) {
								console.log(xhrC[idx].responseText);

								var credibility = JSON.parse(xhrC[idx].responseText);

								if (credibility.error !== undefined)
									credibility.status_id = request.batch[idx].tweet.id;

								response.credibilities.push(credibility);

								count++;

								if (count == request.batch.length) {
									var reqF = {
										sender_id: apiToken+'_'+request.sender_id,
										statuses: statusArr
									};

									try { xhrF.send(JSON.stringify(reqF)); }
									catch(err) { console.log("Couldn't send XMLHttpRequest: ", err); }
								}
							} else {
								response.error = {code:503, message: "Service unavailable."};
								response.statuses = statusArr;

								try { sendResponse(response); }
								catch(err) { console.log("Couldn't send response: ", err); }
							}
						}
					}

					try { xhrC[idx].send(null); }
					catch(err) { console.log("Couldn't send XMLHttpRequest: ", err); }
				})(i);
			}
		}

		return true;
	}
}

function sendCredibilityFeedback(request, sender, sendResponse) {
	if (request.action == 'send_feedback') {
		var query = request.feedback;
		query.sender_id = apiToken+'_'+request.feedback.sender_id;

		var responseURL = apiRoot+'index.php/feedback'+'?token='+apiToken;

		var xhr = new XMLHttpRequest();
		xhr.open("POST", responseURL, true);
		xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
		xhr.onreadystatechange = function() {
			if (xhr.readyState == 4) {
				if (xhr.status == 200) {
					console.log("Response of feedback for "+query.status_id+": ", xhr.responseText);

					try { sendResponse(JSON.parse(xhr.responseText)); }
					catch(err) { console.log("Couldn't send response: ", err); }
				} else {
					console.log("XMLHttpRequest error. "+xhr.statusText);
				}
			}
		}

		try { xhr.send(JSON.stringify(query)); }
		catch(err) { console.log("Couldn't send XMLHttpRequest: ", err); }

		return true;
	}
}