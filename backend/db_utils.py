# backend/db_utils.py

import mysql.connector
from datetime import datetime
import re

def format_mysql_datetime(ts: str) -> str:
    """
    Converts ISO 8601 or UTC timestamp string to MySQL-compatible DATETIME format.
    Handles various timestamp formats including milliseconds.
    """
    if not ts:
        return None
    
    try:
        # Remove timezone info if present (e.g., '+00:00')
        if '+' in ts:
            ts = ts.split('+')[0]
        elif 'Z' in ts:
            ts = ts.replace('Z', '')
        
        # Replace 'T' with space if needed
        ts = ts.replace('T', ' ')
        
        # Strip any extra whitespace
        ts = ts.strip()
        
        # Handle different timestamp formats
        formats_to_try = [
            '%Y-%m-%d %H:%M:%S.%f',     # With microseconds: 2025-04-23 07:24:18.000000
            '%Y-%m-%d %H:%M:%S',        # Without microseconds: 2025-04-23 07:24:18
            '%Y-%m-%d %H:%M',           # Without seconds: 2025-04-23 07:24
            '%Y-%m-%d',                 # Date only: 2025-04-23
        ]
        
        # Try to parse with different formats
        dt = None
        for fmt in formats_to_try:
            try:
                dt = datetime.strptime(ts, fmt)
                break
            except ValueError:
                continue
        
        # If standard formats fail, try handling milliseconds manually
        if dt is None:
            # Handle milliseconds (3 digits) by converting to microseconds (6 digits)
            if '.' in ts and len(ts.split('.')[-1]) == 3:
                # Convert .000 to .000000 for strptime
                ts = ts + '000'
                dt = datetime.strptime(ts, '%Y-%m-%d %H:%M:%S.%f')
            else:
                raise ValueError(f"Unable to parse timestamp format: {ts}")
        
        return dt.strftime('%Y-%m-%d %H:%M:%S')
        
    except Exception as e:
        print(f"[WARNING] Failed to format timestamp: {ts}, error: {e}")
        return None


def save_analysis_to_mysql(data, host="localhost", user="root", password="Shubham#27root", database="sentiment_db", clear_existing=False):
    """
    Saves sentiment analysis results to MySQL.
    If clear_existing=True, deletes old rows before inserting.
    """
    try:
        conn = mysql.connector.connect(
            host=host,
            user=user,
            password=password,
            database=database
        )
        cursor = conn.cursor()

        # Ensure table exists
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS sentiment_analysis (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255),
            sentiment VARCHAR(20),
            sentiment_score FLOAT,
            timestamp DATETIME,
            hashtags TEXT,
            text TEXT,
            platform VARCHAR(50)
        );
        """
        cursor.execute(create_table_sql)

        # Optional: clear existing data in database
        if clear_existing:
            cursor.execute("DELETE FROM sentiment_analysis")
            print(f"[INFO] Cleared existing data from sentiment_analysis table")

        # Insert new data
        insert_sql = """
        INSERT INTO sentiment_analysis (username, sentiment, sentiment_score, timestamp, hashtags, text, platform)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        successful_inserts = 0
        failed_inserts = 0
        
        for item in data:
            try:
                formatted_timestamp = format_mysql_datetime(item.get('timestamp') or item.get('date_time'))
                
                cursor.execute(insert_sql, (
                    item.get('username'),
                    item.get('sentiment'),
                    item.get('sentiment_score'),
                    formatted_timestamp,
                    ','.join(item.get('hashtags', [])) if item.get('hashtags') else '',
                    item.get('text') or item.get('tweet_text') or '',
                    item.get('platform', 'Twitter')
                ))
                successful_inserts += 1
                
            except Exception as e:
                print(f"[ERROR] Failed to insert item: {e}")
                print(f"[ERROR] Problematic item: {item}")
                failed_inserts += 1
                continue

        conn.commit()
        print(f"[INFO] Successfully inserted {successful_inserts} records, {failed_inserts} failed")
        
    except mysql.connector.Error as e:
        print(f"[ERROR] MySQL connection error: {e}")
        
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()