import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'
        self.user = self.scope.get('user')

        await self.channel_layer.group_add(
            self.room_group_name, self.channel_name
        )
        await self.accept()

        if self.user and self.user.is_authenticated:
            await self.set_user_online(True)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_status',
                    'username': self.user.username,
                    'is_online': True,
                },
            )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name, self.channel_name
        )
        if self.user and self.user.is_authenticated:
            await self.set_user_online(False)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_status',
                    'username': self.user.username,
                    'is_online': False,
                },
            )

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type', 'chat_message')

        if msg_type == 'chat_message':
            content = data.get('message', '')
            username = data.get('username', 'Anonymous')
            saved = await self.save_message(username, content)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': content,
                    'username': username,
                    'avatar_color': saved.get('avatar_color', '#6366f1'),
                    'timestamp': saved.get('timestamp', ''),
                    'message_id': saved.get('id', 0),
                },
            )

        elif msg_type == 'typing':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'typing_indicator',
                    'username': data.get('username', 'Someone'),
                    'is_typing': data.get('is_typing', False),
                },
            )

    # ---- group‑send handlers ----

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'username': event['username'],
            'avatar_color': event.get('avatar_color', '#6366f1'),
            'timestamp': event.get('timestamp', ''),
            'message_id': event.get('message_id', 0),
        }))

    async def user_status(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_status',
            'username': event['username'],
            'is_online': event['is_online'],
        }))

    async def typing_indicator(self, event):
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'username': event['username'],
            'is_typing': event['is_typing'],
        }))

    # ---- DB helpers ----

    @database_sync_to_async
    def save_message(self, username, content):
        from django.contrib.auth.models import User
        from .models import Message, Room

        try:
            user = User.objects.get(username=username)
            room = Room.objects.get(id=self.room_id)
            msg = Message.objects.create(
                room=room, sender=user, content=content
            )
            avatar_color = '#6366f1'
            try:
                avatar_color = user.profile.avatar_color
            except Exception:
                pass
            return {
                'id': msg.id,
                'timestamp': msg.timestamp.isoformat(),
                'avatar_color': avatar_color,
            }
        except Exception as exc:
            print(f"Error saving message: {exc}")
            return {'id': 0, 'timestamp': '', 'avatar_color': '#6366f1'}

    @database_sync_to_async
    def set_user_online(self, is_online):
        from .models import UserProfile

        try:
            profile, _ = UserProfile.objects.get_or_create(user=self.user)
            profile.is_online = is_online
            profile.save()
        except Exception:
            pass
