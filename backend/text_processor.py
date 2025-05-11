import re
import nltk
from typing import List, Dict, Any
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

# Download required NLTK resources
try:
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('punkt')
    nltk.download('stopwords')

class TextPreprocessor:
    def __init__(self, language: str = 'english'):
        """Initialize the text preprocessor with language settings."""
        self.stopwords = set(stopwords.words(language))
        
    def clean_text(self, text: str) -> str:
        """Clean text by removing URLs, mentions, hashtags, emojis, and other noise."""
        if not text:
            return ""
            
        # Convert to lowercase
        text = text.lower()
        
        # Remove URLs
        text = re.sub(r'https?://\S+|www\.\S+', '', text)
        
        # Remove user mentions (@username)
        text = re.sub(r'@\w+', '', text)
        
        # Remove hashtags but keep the text
        text = re.sub(r'#(\w+)', r'\1', text)
        
        # Remove RT (retweet) notation
        text = re.sub(r'^rt\s+', '', text)
        
        # Remove emojis (simple regex to remove most common emojis)
        emoji_pattern = re.compile(
            "["
            u"\U0001F600-\U0001F64F"  # emoticons
            u"\U0001F300-\U0001F5FF"  # symbols & pictographs
            u"\U0001F680-\U0001F6FF"  # transport & map symbols
            u"\U0001F700-\U0001F77F"  # alchemical symbols
            u"\U0001F780-\U0001F7FF"  # Geometric Shapes
            u"\U0001F800-\U0001F8FF"  # Supplemental Arrows-C
            u"\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
            u"\U0001FA00-\U0001FA6F"  # Chess Symbols
            u"\U0001FA70-\U0001FAFF"  # Symbols and Pictographs Extended-A
            u"\U00002702-\U000027B0"  # Dingbats
            u"\U000024C2-\U0001F251" 
            "]+", flags=re.UNICODE)
        text = emoji_pattern.sub(r'', text)
        
        # Remove punctuation
        text = re.sub(r'[^\w\s]', '', text)
        
        # Remove multiple spaces
        text = re.sub(r'\s+', ' ', text)
        
        # Trim whitespace
        text = text.strip()
        
        return text
        
    def remove_stopwords(self, text: str) -> str:
        """Remove common stopwords from text."""
        # Tokenize text
        tokens = word_tokenize(text)
        
        # Remove stopwords
        filtered_tokens = [word for word in tokens if word not in self.stopwords]
        
        # Join tokens back into text
        return ' '.join(filtered_tokens)
        
    def preprocess_text(self, text: str, remove_stops: bool = True) -> str:
        """Full preprocessing pipeline for text."""
        # Clean text
        cleaned_text = self.clean_text(text)
        
        # Optionally remove stopwords
        if remove_stops:
            cleaned_text = self.remove_stopwords(cleaned_text)
            
        return cleaned_text
        
    # def extract_hashtags(self, text: str) -> List[str]:
    #     """Extract hashtags from a text."""
    #     # Extract hashtags using regex
    #     hashtags = re.findall(r'#(\w+)', text)
    #     return hashtags
    
    # def extract_hashtags(self, text: str) -> List[str]:
    #     """Extract hashtags from a text with better accuracy."""
    #     if not text:
    #         return []
    #     # Extract hashtags with case preserved
    #     return [tag.strip("#") for tag in re.findall(r'#\w+', text)]

    # def extract_hashtags(self, text: str) -> List[str]:
    #     """Extract all hashtags from the text, normalized and accurate."""
    #     if not text:
    #         return []
        
    #     # Match hashtags starting with # followed by letters, numbers, or underscores
    #     hashtags = re.findall(r'#([A-Za-z0-9_]+)', text)
        
    #     # Normalize (optional): convert to lowercase
    #     return [tag.lower() for tag in hashtags]
        
    # def extract_hashtags(self, text: str) -> List[str]:
    #     """Extract valid hashtags, ignoring numeric-only ones, case-normalized."""
    #     if not text:
    #         return []

    #     # Match hashtags with Unicode-aware word characters
    #     raw_tags = re.findall(r'#([\w\u0080-\uFFFF]+)', text, re.UNICODE)

    #     # Filter out numeric-only hashtags and normalize
    #     return [tag.lower() for tag in raw_tags if not tag.isdigit()]

    def extract_hashtags(self, text: str) -> List[str]:
        """Extract valid hashtags, ignoring numeric-only ones, case-normalized."""
        if not text:
            return []

        # Match hashtags with Unicode-aware word characters
        raw_tags = re.findall(r'#([\w\u0080-\uFFFF]+)', text, re.UNICODE)

        # Filter out numeric-only hashtags and normalize
        return [tag.lower() for tag in raw_tags if not tag.isdigit()]


        
    def preprocess_social_media_data(self, data):
        """Custom preprocessor for your specific data format"""
        if not data:
            return []

        # Handle single item case
        if isinstance(data, dict):
            data = [data]
        elif not isinstance(data, list):
            return []

        results = []
        
        for item in data:
            if not isinstance(item, dict):
                continue
                
            try:
                processed_item = item.copy()
                
                # Handle Twitter data
                if 'tweet_text' in item:
                    processed_item['platform'] = 'twitter'
                    text = item['tweet_text']
                    processed_item['original_text'] = text
                    processed_item['hashtags'] = self.extract_hashtags(text)  # extract before cleaning
                    processed_item['cleaned_text'] = self.preprocess_text(text)

                    
                # Handle Instagram data
                elif 'caption' in item:
                    processed_item['platform'] = 'instagram'
                    text = item['caption']
                    processed_item['original_text'] = text
                    processed_item['cleaned_text'] = self.preprocess_text(text)
                    # Use existing hashtags if available
                    processed_item['hashtags'] = item.get('hashtags', self.extract_hashtags(text))
                
                # Add common metadata
                for field in ['username', 'date_time', 'followers_count', 'likes_count']:
                    if field in item:
                        processed_item[field] = item[field]
                
                results.append(processed_item)
                
            except Exception as e:
                print(f"Error processing item: {str(e)}")
                continue
                
        return results