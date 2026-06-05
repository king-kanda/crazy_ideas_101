from celery import Celery
import os

celery = Celery('shelf', broker=os.environ.get('REDIS_URL', 'redis://localhost:6379'))

celery.conf.beat_schedule = {
    'fetch-trends-all-stores': {
        'task': 'workers.trends.fetch_trends_all_stores',
        'schedule': 86400.0,  # daily
    },
}

celery.conf.timezone = 'UTC'
celery.autodiscover_tasks(['workers'])
