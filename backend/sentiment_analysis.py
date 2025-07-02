import json
import time
import os
from typing import List, Dict, Any, Union, Optional
import requests
from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch
from concurrent.futures import ThreadPoolExecutor
import numpy as np

class RobertaSentimentAnalyzer:
    """Sentiment analyzer using RoBERTa model."""

    def __init__(self, model_name="cardiffnlp/twitter-roberta-base-sentiment", device=None):
        """Initialize RoBERTa sentiment analyzer."""
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModelForSequenceClassification.from_pretrained(model_name)

            # Force CPU usage
            # self.device = torch.device("cpu")
            # print("[INFO] 🧠 Using CPU (forced)")

            # self.model = self.model.to(self.device)
            # self.model.eval()
            
            self.device = torch.device(device) if device else (
                torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")
            )

            if self.device.type == "cuda":
                print("[INFO] ⚡ Using GPU (CUDA)")
                torch.cuda.empty_cache()
            else:
                print("[INFO] 🧠 Using CPU")
            
            # Clear CUDA cache
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                
            self.model = self.model.to(self.device)
            self.model.eval()

            print(f"Initialized RobertaSentimentAnalyzer using {model_name} on {self.device}")
            
            # Define sentiment labels
            self.labels = ['Negative', 'Neutral', 'Positive']
            
        except Exception as e:
            print(f"Error initializing RoBERTa: {e}")
            raise
    
    def _predict_sentiment(self, text):
        if not text or text.isspace():
            return {"sentiment_score": 0.0, "sentiment_category": "Neutral"}

        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=512, padding=True).to(self.device)
        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=1)
            score, pred = torch.max(probs, dim=1)

        return {
            "sentiment_score": score.item(),
            "sentiment_category": self.labels[pred.item()]
        }

    def _analyze_single_item(self, item):
        text = item.get("cleaned_text") or item.get("original_text") or ""
        sentiment = self._predict_sentiment(text)

        return {
            "id": item.get("id"),
            "platform": item.get("platform"),
            "text": text,
            "username": item.get("username"),
            "timestamp": item.get("date_time") or item.get("timestamp"),
            "sentiment": sentiment["sentiment_category"],
            "sentiment_score": sentiment["sentiment_score"],
            "hashtags": item.get("hashtags", []),
            "metrics": {
                "likes": item.get("tweet_like_count") or item.get("likes_count"),
                "shares": item.get("tweet_retweet_count") or item.get("shares")
            }
        }
    def analyze_social_media_data(self, data):
        if not data:
            return []

        if self.device.type == "cuda":
            # GPU: sequential batch (ThreadPool not safe with CUDA)
            return [self._analyze_single_item(item) for item in data]
        else:
            # CPU: parallel execution
            with ThreadPoolExecutor(max_workers=6) as executor:
                return list(executor.map(self._analyze_single_item, data))

class GrokSentimentAnalyzer:
    def __init__(self, api_key: str, model: str = "Grok-3"):
        """Initialize the Grok sentiment analyzer with API credentials."""
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.mcp.com/v1"  # Update with actual MCP API endpoint
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
    def _create_sentiment_prompt(self, texts: List[str]) -> str:
        """Create a prompt for batch sentiment analysis."""
        prompt = (
            "Analyze the sentiment of each text below. "
            "Return a JSON array where each element has 'sentiment' (Positive, Negative, or Neutral) "
            "and 'score' (a value between -1 and 1, where -1 is very negative, 0 is neutral, and 1 is very positive).\n\n"
        )
        
        for i, text in enumerate(texts):
            prompt += f"Text {i+1}: {text}\n"
            
        prompt += "\nResponse format should be a JSON array like this:\n"
        prompt += '[{"sentiment": "Positive", "score": 0.8}, {"sentiment": "Negative", "score": -0.6}, ...]\n'
        
        return prompt
        
    def analyze_batch(self, texts: List[str], batch_size: int = 10) -> List[Dict[str, Any]]:
        """
        Analyze sentiment for a batch of texts to optimize API calls.
        Returns a list of sentiment results, one for each text.
        """
        all_results = []
        
        # Process texts in batches
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i+batch_size]
            
            # Create prompt for this batch
            prompt = self._create_sentiment_prompt(batch)
            
            try:
                # Call Grok API
                response = self._call_grok_api(prompt)
                
                # Parse the response
                if response:
                    batch_results = json.loads(response)
                    all_results.extend(batch_results)
                else:
                    # If API call failed, add neutral sentiment as fallback
                    for _ in batch:
                        all_results.append({"sentiment": "Neutral", "score": 0.0})
                        
                # Add a small delay to avoid rate limits
                time.sleep(0.5)
                
            except Exception as e:
                print(f"Error in sentiment analysis batch: {e}")
                # Add neutral sentiment as fallback for this batch
                for _ in batch:
                    all_results.append({"sentiment": "Neutral", "score": 0.0})
                    
        return all_results
        
    def _call_grok_api(self, prompt: str) -> Optional[str]:
        """Call the Grok API through MCP and return the text response."""
        try:
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant that analyzes sentiment."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.1  # Low temperature for more consistent responses
            }
            
            response = requests.post(
                f"{self.base_url}/completions",
                headers=self.headers,
                json=payload
            )
            
            if response.status_code == 200:
                result = response.json()
                return result["choices"][0]["message"]["content"]
            else:
                print(f"API error: {response.status_code}, {response.text}")
                return None
                
        except Exception as e:
            print(f"Error calling Grok API: {e}")
            return None
            
    def analyze_social_media_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Add sentiment analysis to social media data."""
        analyzed_data = []
        texts_to_analyze = []
        item_map = []  # To map analyzed texts back to their items
        
        # Collect all texts for batch analysis
        for item in data:
            if 'cleaned_text' in item:
                texts_to_analyze.append(item['cleaned_text'])
                item_map.append(('item', item))
                
            # Also analyze comments if available
            if 'comments' in item and isinstance(item['comments'], list):
                for comment in item['comments']:
                    if 'cleaned_text' in comment:
                        texts_to_analyze.append(comment['cleaned_text'])
                        item_map.append(('comment', comment))
                        
        # Perform batch analysis
        if texts_to_analyze:
            sentiment_results = self.analyze_batch(texts_to_analyze)
            
            # Map results back to items
            for (item_type, item_data), sentiment in zip(item_map, sentiment_results):
                item_data['sentiment'] = sentiment['sentiment']
                item_data['sentiment_score'] = sentiment['score']
                
        # Reorganize data back into the original structure
        processed_items = {}
        for item_type, item_data in item_map:
            if item_type == 'item':
                item_id = item_data['id']
                processed_items[item_id] = item_data
                
        # Add comments back to their parent items
        for item_type, item_data in item_map:
            if item_type == 'comment':
                for item_id, item in processed_items.items():
                    if 'comments' in item:
                        for i, comment in enumerate(item['comments']):
                            if comment['id'] == item_data['id']:
                                item['comments'][i] = item_data
                                
        # Convert back to list
        analyzed_data = list(processed_items.values())
        
        return analyzed_data