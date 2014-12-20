TweetCred = (function($) {
	var isActive   = false;
	var batchSize  = 8;
	var hostUser   = null;
	var currentURL = '';

	var datastore = (function() {
		var tweetDataQueue = [];

		var searchQueue = function(tweetData) {
			var found = false;

			for (var i = 0; i < tweetDataQueue.length; i++) {
				if (tweetDataQueue[i].tweet.id == tweetData.tweet.id) {
					found = true;
					break;
				}
			}

			return found;
		}

		return {
			queueTweetData: function(tweetData) { if (!searchQueue(tweetData)) tweetDataQueue.push(tweetData); },

			dequeueTweetData: function() { return tweetDataQueue.shift(); },

			countQueuedTweetData: function() { return tweetDataQueue.length; },

			peekAtQueuedTweetData: function() { return tweetDataQueue[0]; },

			resetQueue: function() { tweetDataQueue.length = 0; }
		}
	})();

	function getTweetElements() {
		var tweetElements = $('.tweet, .ProfileTweet').filter(function() {
			return ($(this).find('.tweetcred-credibility').length == 0);
		});

		$.each(tweetElements, function(index, tweetElement) {
			var span = $("<span class=\"tweetcred-credibility\"></span>");

			span.attr('data-status', 'loading');
			span.attr('data-tweet-id', $(tweetElement).data('tweet-id'));

			if ($(tweetElement).hasClass('permalink-tweet')) {
				// For tweet page
				$(tweetElement).find('.client-and-actions .metadata')
				.after($('<div>').append(span.clone()).html());
			} else if ($(tweetElement).hasClass('ProfileTweet')) {
				// For profile
				span.addClass('u-pullLeft');

				$(tweetElement).find('.ProfileTweet-originalAuthor')
				.after($('<div>').append(span.clone()).html());
			} else {
				// For timeline
				$(tweetElement).find('.stream-item-header .account-group')
				.after($('<div>').append(span.clone()).html());
			}

			span = null;
		});

		return tweetElements;
	}

	function extractTweetData(tweetElement) {
		var tweetData = {author: {}, tweet: {}};

		tweetData.author.id          = $(tweetElement).attr('data-user-id');
		tweetData.author.name        = $(tweetElement).attr('data-name');
		tweetData.author.screen_name = $(tweetElement).attr('data-screen-name');
		tweetData.tweet.id           = $(tweetElement).attr('data-tweet-id');
		tweetData.tweet.post_text    = $(tweetElement).find('.tweet-text, .ProfileTweet-text').text();
		tweetData.tweet.link_count   = $(tweetElement).find('.tweet-text, .ProfileTweet-text .twitter-timeline-link').length;
		tweetData.source_url         = currentURL;

		// console.log(tweetData);

		return tweetData;
	}

	function appendCredibility(credibilityData) {
		var elements = $('.tweetcred-credibility[data-tweet-id=\"'+credibilityData.status_id+'\"]');

		$.each(elements, function(index, element) {
			var span = $("<span class=\"tweetcred-credibility\"></span>");

			span.attr('data-status', 'loaded');
			span.attr('data-tweet-id', credibilityData.status_id);

			if ($(element).hasClass('u-pullLeft'))
				span.addClass('u-pullLeft');

			$(element).replaceWith(span);

			if (credibilityData.error !== undefined) {
				span.attr('data-title', "Failed to load credibility!");

				switch (credibilityData.error.code) {
					case 179:
						span.attr('data-content', "This tweet is protected.");
						break;

					case 717:
						span.attr('data-content', "Loading credibility is taking longer than usual.");
						break;

					default:
						span.attr('data-content', "Please reload the page in some time."+credibilityData.error.code);
				}

				span.append("<i class=\"icon-exclamation-sign\"></i>");

				span = null;
			} else {
				// Add bold credibility icons
				for (var i = 0; i < credibilityData.status_credibility; i++)
					span.append("<i class=\"icon-certificate\" data-score=\""+(i + 1)+"\"></i>");

				// Add muted credibility icons
				for (var i = 0; i < (7 - credibilityData.status_credibility); i++)
					span.append("<i class=\"icon-certificate icon-muted\" data-score=\""+(credibilityData.status_credibility + i + 1)+"\"></i>");

				span.attr('data-title', "Credibility: "
					+(credibilityData.status_credibility <= 2 ? 'Low' : (credibilityData.status_credibility <= 5 ? 'Medium' : 'High'))
					+" ("+credibilityData.status_credibility+"/7)"
				);

				chrome.storage.local.get('feedback_'+credibilityData.status_id, function(data) {
					if (!data['feedback_'+credibilityData.status_id]) {
						var pos = $("<i class=\"icon-thumbs-up\"></i>");
						pos.attr('data-tweet-id', credibilityData.status_id);
						pos.attr('data-credibility', credibilityData.status_credibility);
						pos.attr('data-agree', 'true');

						var neg = $("<i class=\"icon-thumbs-down\"></i>");
						neg.attr('data-tweet-id', credibilityData.status_id);
						neg.attr('data-credibility', credibilityData.status_credibility);
						neg.attr('data-agree', 'false');

						span.attr('data-content', "Do you agree? "+$('<div>').append(pos.clone()).html()+' '+$('<div>').append(neg.clone()).html());

						pos = null;
						neg = null;
					} else
						span.attr('data-content', "Your feedback is recorded.");

					span = null;
				});
			}
		});

		elements = null;
	}

	return {
		initialize: function() {
			console.log("Add logo");

			chrome.runtime.sendMessage({action: 'show_page_action'});

			try {
				var initData = JSON.parse($('#init-data').val());

				if (initData.loggedIn) hostUser = initData.userId;
			} catch(err) {
				// console.log("init-data not found.");
			}

			$(document).on('mousemove', function() {
				$(document).off('mousemove');

				// Load credibilities
				setTimeout(TweetCred.exec, 500);

				// Flash logo for a few seconds
				var panel = $('<div class="panel panel-default tweetcred-logo"></div>');
				var logo  = new Image();

				panel.append("<span>FB credibility powered by</span><br/>");

				logo.src = chrome.extension.getURL("img/logo.png");

				$(logo).load(function() {
					panel.append(logo);

					$(document.body).append(panel);

					panel.fadeIn(600, function() {
						setTimeout(function() {
							panel.fadeOut(600, function() {
								panel.remove();

								panel = null;
								logo  = null;
							});
						}, 1800);
					});
				});
			});

		},

		exec: function() {
			// Reset queue in datastore if a new timeline is loaded
			console.log('start content script');
			if (window.location.href != currentURL) {
				isActive   = false;
				currentURL = window.location.href;
				datastore.resetQueue();
				chrome.runtime.sendMessage({action: 'show_page_action'});
			}

			console.log("Executing Twit Digest");

			var tweetElements = getTweetElements();

			console.log('tweet elements');
			console.log(tweetElements);

			// Queue tweets in datastore
			for (var i = 0; i < tweetElements.length; i++) {
				var tweetData = extractTweetData(tweetElements[i]);
				datastore.queueTweetData(tweetData);

				console.log("Queued "+tweetData.tweet.id);

				tweetElements[i] = null;
			}

			tweetElements.length = 0;

			// Check whether poll is already running
			if (!isActive) {
				isActive = true;
				console.log("Started polling");

				(function poll() {
					if (datastore.countQueuedTweetData() > 0) {
						function batch(index, tweetBatch) {
							var queuedTweetData = datastore.peekAtQueuedTweetData();

							if (index < batchSize && queuedTweetData !== undefined) {
								datastore.dequeueTweetData();

								// Search for credibility data in cache
								chrome.storage.local.get('credibility_'+queuedTweetData.tweet.id, function(data) {
									if (data['credibility_'+queuedTweetData.tweet.id] === undefined) {
										// Add tweet to batch if not found in cache
										tweetBatch.push(queuedTweetData);

										$('.tweetcred-credibility[data-tweet-id=\"'+queuedTweetData.tweet.id+'\"][data-status=\"loading\"]')
										.append("<i class=\"icon-spinner icon-spin\"></i>");

										// Show error after sometime if credibilities fail to load
										setTimeout(function() {
											if ($('.tweetcred-credibility[data-tweet-id=\"'+queuedTweetData.tweet.id+'\"][data-status=\"loading\"]').length > 0) {
												appendCredibility({
													status_id: queuedTweetData.tweet.id,
													error: {
														code: 717,
														message: "Connection timed out."
													}
												});
											}
										}, 30000);

										// console.log("Added "+queuedTweetData.tweet.id+" to batch");

										batch(index + 1, tweetBatch);
									} else {
										// Display credibility from cached data
										// console.log("Fetched credibility from cache:", data['credibility_'+queuedTweetData.tweet.id]);

										appendCredibility(data['credibility_'+queuedTweetData.tweet.id]);

										batch(index, tweetBatch);
									}
								});
							} else {
								// Fetch credibilities for tweets in batch
								console.log('else fetech');
								fetch(tweetBatch);
							}
						}

						function fetch(tweetBatch) {
							if (tweetBatch.length > 0) {
								var request = {action: 'fetch_credibility', sender_id: hostUser, batch: tweetBatch};
								
								// Fetch array of credibility data from API
								chrome.runtime.sendMessage(request, function(response) {
									if (response.error === undefined) {

										for (var i = 0; i < response.credibilities.length; i++) {
											var credibilityData = response.credibilities[i];

											appendCredibility(credibilityData);

											if (credibilityData.error === undefined) {
												// Display credibility from fetched data and add it to cache
												// console.log("Fetched credibility from API:", credibilityData);

												var credibilityObject = {};
												credibilityObject['credibility_'+credibilityData.status_id] = credibilityData;
												chrome.storage.local.set(credibilityObject);
											} else {
												// console.log("Error fetching credibility:", credibilityData);
											}
										}

										// Poll after completing asynchronous action
										poll();
									} else {
										// console.log("Error accessing Twit Digest API:", response);

										for (var i = 0; i < response.statuses.length; i++) {
											var credibilityData = {};

											credibilityData.error = response.error;
											credibilityData.status_id = response.statuses[i];

											appendCredibility(credibilityData);
										}

										poll();
									}
								});
							} else {
								poll();
							}
						}

						// Add tweets to batch
						batch(0, []);
					} else {
						isActive = false;
						// console.log("Suspended polling");
					}
				})();
			}
		},

		feedback: function(data, element) {
			// console.log("Feedback: ", data);

			request = {action: 'send_feedback', feedback: data};

			chrome.runtime.sendMessage(request, function(response) {
				if (response.message == 'feedback_stored') $(element).html("Thank you for your feedback.");
				else if (response.message == 'feedback_exists') $(element).html("Your feedback is already recorded.");

				$('.tweetcred-credibility[data-tweet-id="'+data.status_id+'"]').attr('data-content', "Your feedback is recorded.");

				var feedbackObject = {};
				feedbackObject['feedback_'+data.status_id] = true;
				chrome.storage.local.set(feedbackObject);
			});
		}
	}
})($);

TweetCred.initialize();