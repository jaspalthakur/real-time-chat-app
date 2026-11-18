from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Room, Message, UserProfile
import random


class UserSerializer(serializers.ModelSerializer):
    is_online = serializers.SerializerMethodField()
    avatar_color = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_online', 'avatar_color']

    def get_is_online(self, obj):
        try:
            return obj.profile.is_online
        except UserProfile.DoesNotExist:
            return False

    def get_avatar_color(self, obj):
        try:
            return obj.profile.avatar_color
        except UserProfile.DoesNotExist:
            return '#6366f1'


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, default='')
    password = serializers.CharField(min_length=6, write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )
        colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b',
                  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6']
        UserProfile.objects.create(user=user, avatar_color=random.choice(colors))
        return user


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    sender_avatar_color = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'room', 'sender', 'sender_name',
                  'sender_avatar_color', 'content', 'timestamp']
        read_only_fields = ['sender', 'timestamp']

    def get_sender_avatar_color(self, obj):
        try:
            return obj.sender.profile.avatar_color
        except UserProfile.DoesNotExist:
            return '#6366f1'


class RoomSerializer(serializers.ModelSerializer):
    members = UserSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = ['id', 'name', 'description', 'is_group',
                  'members', 'last_message', 'member_count', 'created_at']

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-timestamp').first()
        if msg:
            return {
                'content': msg.content,
                'sender': msg.sender.username,
                'timestamp': str(msg.timestamp),
            }
        return None

    def get_member_count(self, obj):
        return obj.members.count()
