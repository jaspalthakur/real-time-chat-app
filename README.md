# 🗨️ ChatterBox — Real-Time Chat Application

A full-featured, real-time chat application with a stunning modern UI, built with **Django Channels** (WebSockets) and **React** (Vite + Tailwind CSS).

![Tech Stack](https://img.shields.io/badge/Django-6.1-green?logo=django)
![Tech Stack](https://img.shields.io/badge/React-19-blue?logo=react)
![Tech Stack](https://img.shields.io/badge/WebSockets-Channels-purple)
![Tech Stack](https://img.shields.io/badge/Tailwind_CSS-4-cyan?logo=tailwindcss)

## ✨ Features

- **Real-time messaging** — Instant message delivery via WebSockets (Django Channels + Daphne)
- **JWT authentication** — Secure login/register with `djangorestframework-simplejwt`
- **Group channels** — Create and join chat rooms (`#General`, `#Random`, `#Tech` pre-seeded)
- **Online/Offline indicators** — Live presence tracking with green glow dots
- **Typing indicators** — See who's typing in real-time with animated dots
- **Message history** — Persistent storage with SQLite (swappable to MongoDB)
- **Members panel** — Toggleable right panel showing online/offline users
- **Channel search** — Filter channels instantly from the sidebar
- **Emoji picker** — Quick emoji insertion with a grid picker
- **Date separators** — Messages grouped by date ("Today", "Yesterday", etc.)
- **Message grouping** — Consecutive messages from the same user collapse
- **Responsive design** — Slide-out sidebar with blur backdrop on mobile
- **Glassmorphism UI** — Animated mesh gradients, blur effects, smooth transitions

## 🌐 1-Click Netlify / Cloud Deployment

ChatterBox includes built-in support for **Netlify** serverless deployment with managed Postgres (Neon/Netlify DB) or in-memory fallback!

- **Frontend build:** Automatic React + Vite compilation to `frontend/dist`
- **Serverless API:** High-speed Netlify Function (`netlify/functions/api.js`) providing all REST and chat endpoints
- **Database:** Auto-configures PostgreSQL tables with `@neondatabase/serverless` when `DATABASE_URL` or `NETLIFY_DATABASE_URL` is present, or falls back seamlessly to in-memory store
- **Real-Time Sync:** Dual-engine architecture with WebSockets + smart polling fallback and auto-reconnect

To deploy:
1. Push to your GitHub repo
2. Connect your repo in [Netlify](https://app.netlify.com/)
3. Netlify will detect `netlify.toml` automatically and build both the frontend and serverless API!

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.14, Django 6.1, Django Channels, Daphne (ASGI) |
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, Lucide Icons |
| **Auth** | JWT (djangorestframework-simplejwt) |
| **WebSocket** | Django Channels with In-Memory Channel Layer |
| **Database** | SQLite (dev) — ready for MongoDB swap |

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Clone & set up backend

```bash
git clone https://github.com/jaspalthakur/real-time-chat-app.git
cd real-time-chat-app

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install django channels daphne pymongo mongomock djangorestframework django-cors-headers pyjwt djangorestframework-simplejwt python-dotenv mongoengine

# Run migrations & seed rooms
cd backend
python manage.py migrate
python -c "
import django, os
os.environ['DJANGO_SETTINGS_MODULE']='chat_project.settings'
django.setup()
from chat.models import Room
Room.objects.get_or_create(name='General', defaults={'description': 'General discussion'})
Room.objects.get_or_create(name='Random', defaults={'description': 'Off-topic banter'})
Room.objects.get_or_create(name='Tech', defaults={'description': 'Tech talk and coding'})
print('Rooms seeded!')
"

# Start the ASGI server
python -m daphne -b 0.0.0.0 -p 8000 chat_project.asgi:application
```

### 2. Set up frontend

```bash
# In a new terminal
cd frontend
npm install
npm run dev
```

### 3. Open the app

Navigate to **http://localhost:5173** (or the port Vite shows).

1. **Register** a new account
2. Start chatting in `#General`
3. Open a second browser tab, register another user, and see real-time messaging in action! 🎉

## 📁 Project Structure

```
├── backend/
│   ├── chat/
│   │   ├── consumers.py      # WebSocket consumer (chat, typing, presence)
│   │   ├── middleware.py      # JWT auth middleware for WebSocket
│   │   ├── models.py          # Room, Message, UserProfile models
│   │   ├── routing.py         # WebSocket URL routing
│   │   ├── serializers.py     # DRF serializers
│   │   ├── urls.py            # REST API endpoints
│   │   └── views.py           # Auth, rooms, messages API views
│   ├── chat_project/
│   │   ├── asgi.py            # ASGI application with Channels routing
│   │   ├── settings.py        # Django settings (CORS, JWT, Channels)
│   │   └── urls.py            # Project URL config
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat.jsx       # Main chat interface
│   │   │   └── Login.jsx      # Auth page
│   │   ├── api.js             # Axios instance with JWT interceptor
│   │   ├── App.jsx            # Root component
│   │   └── index.css          # Tailwind + custom animations
│   ├── .env                   # API/WS URL config
│   └── vite.config.js
└── .gitignore
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register/` | Register a new user |
| POST | `/api/login/` | Login and get JWT tokens |
| GET | `/api/me/` | Get current user profile |
| GET | `/api/rooms/` | List joined rooms |
| POST | `/api/rooms/create/` | Create a new room |
| POST | `/api/rooms/<id>/join/` | Join a room |
| GET | `/api/rooms/<id>/messages/` | Get room message history |
| GET | `/api/users/` | List all users |
| GET | `/api/users/online/` | List online users |

**WebSocket:** `ws://localhost:8000/ws/chat/<room_id>/?token=<JWT>`

## 📄 License

MIT
