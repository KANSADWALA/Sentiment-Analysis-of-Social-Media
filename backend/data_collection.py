import tweepy
import instaloader
import json
import time
from typing import List, Dict, Any, Optional
import requests
from backend.config import INSTAGRAM_CSRF_TOKEN, INSTAGRAM_DS_USER_ID, INSTAGRAM_SESSION_ID

class TwitterCollector:
    def __init__(self, bearer_token: str):
        """Initialize Twitter API client with bearer token."""
        if not bearer_token:
            raise ValueError("Twitter bearer token is required")
        self.client = tweepy.Client(bearer_token=bearer_token)
        
    def fetch_tweets_by_hashtag(self, hashtag: str, max_results: int = 50) -> List[Dict[str, Any]]:
        """Fetch tweets containing a specific hashtag."""
        tweets = []
        try:
            # Remove # if present in the hashtag
            hashtag = hashtag.replace('#', '')
            
            # Search for tweets with the hashtag
            response = self.client.search_recent_tweets(
                query=f"#{hashtag} -is:retweet", 
                max_results=max_results,
                tweet_fields=['created_at', 'text', 'public_metrics']
            )
            
            if response.data:
                for tweet in response.data:
                    tweets.append({
                        'id': tweet.id,
                        'text': tweet.text,
                        'created_at': tweet.created_at.isoformat(),
                        'like_count': tweet.public_metrics['like_count'],
                        'retweet_count': tweet.public_metrics['retweet_count'],
                        'reply_count': tweet.public_metrics['reply_count'],
                        'platform': 'twitter'
                    })
                    
            return tweets
        except Exception as e:
            print(f"Error fetching tweets: {e}")
            raise RuntimeError(f"Failed to fetch tweets: {str(e)}")
            
    def fetch_tweets_by_user(self, username: str, max_results: int = 50) -> List[Dict[str, Any]]:
        """Fetch tweets from a specific user."""
        tweets = []
        try:
            # Remove @ if present in the username
            username = username.replace('@', '')
            
            # Get user ID first
            user = self.client.get_user(username=username)
            if not user.data:
                raise ValueError(f"User {username} not found")
                
            user_id = user.data.id
            
            # Get user's tweets
            response = self.client.get_users_tweets(
                id=user_id,
                max_results=max_results,
                tweet_fields=['created_at', 'text', 'public_metrics']
            )
            
            if response.data:
                for tweet in response.data:
                    tweets.append({
                        'id': tweet.id,
                        'text': tweet.text,
                        'created_at': tweet.created_at.isoformat(),
                        'like_count': tweet.public_metrics['like_count'],
                        'retweet_count': tweet.public_metrics['retweet_count'],
                        'reply_count': tweet.public_metrics['reply_count'],
                        'platform': 'twitter'
                    })
            
            return tweets
        except Exception as e:
            print(f"Error fetching user tweets: {e}")
            raise RuntimeError(f"Failed to fetch user tweets: {str(e)}")

class InstagramCollector:
    def __init__(self, session_id: str = None, ds_user_id: str = None, csrf_token: str = None):
        """Initialize Instagram data collector with optional credentials."""
        self.loader = instaloader.Instaloader()
        self.session_id = session_id or INSTAGRAM_SESSION_ID
        self.ds_user_id = ds_user_id or INSTAGRAM_DS_USER_ID
        self.csrf_token = csrf_token or INSTAGRAM_CSRF_TOKEN
        self.logged_in = False

    def _validate_credentials(self):
        """Validate that all required credentials are present."""
        if not all([self.session_id, self.ds_user_id, self.csrf_token]):
            raise ValueError("Instagram credentials (session_id, ds_user_id, csrf_token) are required")

    def _get_headers_and_cookies(self):
        """Get headers and cookies for Instagram API requests."""
        self._validate_credentials()
        
        cookies = {
            "sessionid": self.session_id,
            "ds_user_id": self.ds_user_id,
            "csrftoken": self.csrf_token
        }

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'X-CSRFToken': self.csrf_token,
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://www.instagram.com/explore/tags/',
            'Cookie': "; ".join([f"{k}={v}" for k, v in cookies.items()]),
            'Connection': 'keep-alive',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty'
        }
        
        return headers, cookies
        
    def fetch_post_data(self, post_url: str) -> Optional[Dict[str, Any]]:
        """Fetch data for a single Instagram post."""
        try:
            self._validate_credentials()
            shortcode = post_url.strip('/').split('/')[-1]

            # Get headers before using them - this was missing in the original code
            headers, cookies = self._get_headers_and_cookies()
            
            post = instaloader.Post.from_shortcode(self.loader.context, shortcode)

            post_data = {
                'id': post.shortcode,
                'caption': post.caption if post.caption else "",
                'like_count': post.likes,
                'comment_count': post.comments,
                'created_at': post.date_utc.isoformat(),
                'hashtags': list(post.caption_hashtags),
                'comments': [],
                'platform': 'instagram'
            }

            # Try fetching comments using GraphQL endpoint
            try:
                graphql_url = f"https://www.instagram.com/api/v1/media/{post.mediaid}/comments/?can_support_threading=true&permalink_enabled=false"
                response = requests.get(graphql_url, headers=headers)
                
                if response.status_code == 200:
                    json_data = response.json()
                    for c in json_data.get('comments', [])[:20]:
                        post_data['comments'].append({
                            'id': c.get('pk'),
                            'text': c.get('text'),
                            'created_at': c.get('created_at')
                        })
                else:
                    print(f"Failed to fetch comments: {response.status_code} - {response.text}")
            except Exception as comment_error:
                print(f"Warning: Failed to fetch comments - {comment_error}")

            return post_data
        except Exception as e:
            print(f"Error fetching Instagram post: {e}")
            raise RuntimeError(f"Failed to fetch Instagram post: {str(e)}")
# class InstagramCollector:
#     def __init__(self, session_id: str = None, ds_user_id: str = None, csrf_token: str = None):
#         """Initialize Instagram data collector with optional credentials."""
#         self.loader = instaloader.Instaloader()
#         self.session_id = session_id or INSTAGRAM_SESSION_ID
#         self.ds_user_id = ds_user_id or INSTAGRAM_DS_USER_ID
#         self.csrf_token = csrf_token or INSTAGRAM_CSRF_TOKEN
#         self.logged_in = False

#     def _validate_credentials(self):
#         """Validate that all required credentials are present."""
#         if not all([self.session_id, self.ds_user_id, self.csrf_token]):
#             raise ValueError("Instagram credentials (session_id, ds_user_id, csrf_token) are required")

#     def _get_headers_and_cookies(self):
#         """Get headers and cookies for Instagram API requests."""
#         self._validate_credentials()
        
#         cookies = {
#             "sessionid": self.session_id,
#             "ds_user_id": self.ds_user_id,
#             "csrftoken": self.csrf_token
#         }

#         headers = {
#             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
#             'Accept': '*/*',
#             'Accept-Language': 'en-US,en;q=0.9',
#             'Accept-Encoding': 'gzip, deflate, br',
#             'X-CSRFToken': self.csrf_token,
#             'X-Requested-With': 'XMLHttpRequest',
#             'Referer': f'https://www.instagram.com/explore/tags/',
#             'Cookie': "; ".join([f"{k}={v}" for k, v in cookies.items()]),
#             'Connection': 'keep-alive',
#             'Sec-Fetch-Site': 'same-origin',
#             'Sec-Fetch-Mode': 'cors',
#             'Sec-Fetch-Dest': 'empty'
#         }


#         # headers = {
#         #     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
#         #     'X-Requested-With': 'XMLHttpRequest',
#         #     "Cookie": "; ".join([f"{k}={v}" for k, v in cookies.items()])
#         # }
        
#         return headers, cookies
        
    def fetch_post_data(self, post_url: str) -> Optional[Dict[str, Any]]:
        """Fetch data for a single Instagram post."""
        try:
            self._validate_credentials()
            shortcode = post_url.strip('/').split('/')[-1]

            headers, cookies = self._get_headers_and_cookies()
            post = instaloader.Post.from_shortcode(self.loader.context, shortcode)

            post_data = {
                'id': post.shortcode,
                'caption': post.caption if post.caption else "",
                'like_count': post.likes,
                'comment_count': post.comments,
                'created_at': post.date_utc.isoformat(),
                'hashtags': list(post.caption_hashtags),
                'comments': [],
                'platform': 'instagram'
            }

            # Try fetching comments using GraphQL endpoint
            try:
                graphql_url = f"https://www.instagram.com/api/v1/media/{post.mediaid}/comments/?can_support_threading=true&permalink_enabled=false"
                response = requests.get(graphql_url, headers=headers)
                
                if response.status_code == 200:
                    json_data = response.json()
                    for c in json_data.get('comments', [])[:20]:
                        post_data['comments'].append({
                            'id': c.get('pk'),
                            'text': c.get('text'),
                            'created_at': c.get('created_at')
                        })
                else:
                    print(f"Failed to fetch comments: {response.status_code} - {response.text}")
            except Exception as comment_error:
                print(f"Warning: Failed to fetch comments - {comment_error}")

            return post_data
        except Exception as e:
            print(f"Error fetching Instagram post: {e}")
            raise RuntimeError(f"Failed to fetch Instagram post: {str(e)}")

    def fetch_hashtag_posts(self, hashtag: str, max_posts: int = 10) -> List[Dict[str, Any]]:
        """Fetch Instagram posts using hashtag via direct API with cookies."""
        try:
            self._validate_credentials()
            posts = []
            hashtag = hashtag.replace('#', '')
            
            headers, _ = self._get_headers_and_cookies()
            url = f"https://www.instagram.com/api/v1/tags/web_info/?__a=1&__d=dis&tag_name={hashtag}"
            
            response = requests.get(url, headers=headers)
            if response.status_code != 200:
                raise RuntimeError(f"Instagram API error: {response.status_code} - {response.text}")

            data = response.json()
            edges = data.get("data", {}).get("recent", {}).get("sections", [])
            
            count = 0
            for section in edges:
                for media in section.get("layout_content", {}).get("medias", []):
                    node = media.get("media")
                    post_data = {
                        "id": node.get("code"),
                        "caption": node.get("caption", {}).get("text", ""),
                        "like_count": node.get("like_count"),
                        "comment_count": node.get("comment_count"),
                        "created_at": node.get("taken_at"),
                        "hashtags": [f"#{hashtag}"],
                        "platform": "instagram"
                    }
                    posts.append(post_data)
                    count += 1
                    if count >= max_posts:
                        break
                if count >= max_posts:
                    break

            print(f"Fetched {len(posts)} posts for #{hashtag}")
            return posts
            
        except Exception as e:
            print(f"Error fetching Instagram hashtag posts: {e}")
            raise RuntimeError(f"Failed to fetch Instagram hashtag posts: {str(e)}")