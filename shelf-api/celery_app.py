import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from celery import Celery

celery = Celery('palda', broker=os.environ.get('REDIS_URL', 'redis://localhost:6379'))

celery.conf.beat_schedule = {
    'fetch-trends-all-stores': {
        'task': 'workers.trends.fetch_trends_all_stores',
        'schedule': 86400.0,  # daily
    },
    'meta-token-health-check': {
        'task': 'workers.meta_events.meta_token_health_check',
        'schedule': 3600.0,  # hourly
    },
}

celery.conf.timezone = 'UTC'
celery.autodiscover_tasks(['workers'])
