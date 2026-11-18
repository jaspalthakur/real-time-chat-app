from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import Room, Message, UserProfile
from .serializers import (
    RegisterSerializer, UserSerializer, RoomSerializer, MessageSerializer
)


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        # Auto-join the General room
        general, _ = Room.objects.get_or_create(
            name='General',
            defaults={'description': 'General discussion for everyone'}
        )
        general.members.add(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username', '')
    password = request.data.get('password', '')
    user = authenticate(username=username, password=password)
    if user:
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })
    return Response(
        {'error': 'Invalid credentials'},
        status=status.HTTP_401_UNAUTHORIZED
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def room_list(request):
    rooms = Room.objects.filter(members=request.user)
    serializer = RoomSerializer(rooms, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_room(request):
    name = request.data.get('name', '').strip()
    description = request.data.get('description', '')
    member_ids = request.data.get('members', [])
    if not name:
        return Response(
            {'error': 'Room name is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    room, created = Room.objects.get_or_create(
        name=name, defaults={'description': description}
    )
    room.members.add(request.user)
    for uid in member_ids:
        try:
            room.members.add(User.objects.get(id=uid))
        except User.DoesNotExist:
            pass
    return Response(RoomSerializer(room).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_room(request, room_id):
    try:
        room = Room.objects.get(id=room_id)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)
    room.members.add(request.user)
    return Response(RoomSerializer(room).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def room_messages(request, room_id):
    try:
        room = Room.objects.get(id=room_id, members=request.user)
    except Room.DoesNotExist:
        return Response(
            {'error': 'Room not found'},
            status=status.HTTP_404_NOT_FOUND,
        )
    messages = room.messages.order_by('-timestamp')[:100]
    messages = reversed(list(messages))
    return Response(MessageSerializer(messages, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def online_users(request):
    profiles = UserProfile.objects.filter(is_online=True).select_related('user')
    users = [p.user for p in profiles]
    return Response(UserSerializer(users, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def all_users(request):
    users = User.objects.exclude(id=request.user.id)
    return Response(UserSerializer(users, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_rooms(request):
    rooms = Room.objects.exclude(members=request.user)
    return Response(RoomSerializer(rooms, many=True).data)
