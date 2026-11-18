from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login_view, name='login'),
    path('me/', views.me, name='me'),
    path('rooms/', views.room_list, name='room_list'),
    path('rooms/create/', views.create_room, name='create_room'),
    path('rooms/available/', views.available_rooms, name='available_rooms'),
    path('rooms/<int:room_id>/join/', views.join_room, name='join_room'),
    path('rooms/<int:room_id>/messages/', views.room_messages, name='room_messages'),
    path('users/', views.all_users, name='all_users'),
    path('users/online/', views.online_users, name='online_users'),
]
