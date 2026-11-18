from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def api_root(request):
    return JsonResponse({
        'name': 'ChatterBox API',
        'version': '1.0.0',
        'status': 'running',
        'endpoints': {
            'api': '/api/',
            'admin': '/admin/',
            'websocket': 'ws://localhost:8000/ws/chat/<room_id>/',
        },
        'frontend': 'http://localhost:5174',
    })


urlpatterns = [
    path('', api_root, name='api_root'),
    path('admin/', admin.site.urls),
    path('api/', include('chat.urls')),
]
