# Video Script: Banana Game Implementation Analysis

## Introduction (1 minute)
"Hello everyone! Today I'll be walking you through my implementation of a Banana Game using the Banana API. I've developed a complete web application with user authentication, score tracking, and a leaderboard system. I'll demonstrate how I've incorporated key software architecture principles and distributed systems concepts into this implementation. Let me first show you the game in action."

[Demo the login, signup, and game running with the leaderboard]

## 1. Software Design Principles: Low Coupling and High Cohesion (2.5 minutes)

### Low Coupling
"Let's first look at how I've implemented low coupling in my code. The main game logic is separated into distinct components:

1. The `BananaGame` class handles the core game logic
2. The `BananaApiService` manages all external API communications
3. The `DatabaseService` handles all database operations
4. The `AuthService` manages user authentication
5. The `EventService` coordinates events across the system
6. The Express server handles HTTP routing and requests

This separation ensures that each component has a single responsibility and can be modified independently. For example, if we wanted to change the database from SQLite to another system, we only need to modify the `DatabaseService` without touching any other component.

Let me show you the relevant code structure:"
[Show the class structure and dependency injection]

### High Cohesion
"Now, let's look at high cohesion. Each class is designed to handle related functionality:

1. `BananaGame` class:
   - Manages game state
   - Controls game flow
   - Manages scoring
   - Publishes game events

2. `BananaApiService`:
   - Focuses solely on API communication
   - Handles data transformation
   - Manages error handling for API calls

3. `DatabaseService`:
   - Handles user data persistence
   - Manages score storage and retrieval
   - Encapsulates all database operations

4. `AuthService`:
   - Manages user authentication
   - Handles token generation and validation
   - Provides authentication middleware

This high cohesion makes the code more maintainable and easier to understand."

## 2. Event-Driven Programming (2.5 minutes)

"Event-driven programming is a crucial part of my implementation. I've created a dedicated event system that coordinates communication across all components.

1. I've created a dedicated `EventService` class that uses the Singleton pattern to ensure a single event bus:
```typescript
export class EventService {
  private static instance: EventService;
  private listeners: Map<EventType, EventHandler[]>;
  private history: Array<{ type: EventType, payload: EventPayload, timestamp: Date }>;

  // Singleton pattern
  public static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }
}
```

2. The service allows components to subscribe to events:
```typescript
public subscribe(eventType: EventType, handler: EventHandler): () => void {
  if (!this.listeners.has(eventType)) {
    this.listeners.set(eventType, []);
  }
  
  this.listeners.get(eventType)!.push(handler);
  
  // Return unsubscribe function
  return () => {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  };
}
```

3. Components can publish events to notify the system of state changes:
```typescript
public publish(eventType: EventType, payload: EventPayload = {}): void {
  // Store in history
  this.history.push({
    type: eventType,
    payload,
    timestamp: new Date()
  });
  
  // Notify all subscribers
  const handlers = this.listeners.get(eventType);
  if (handlers) {
    handlers.forEach(handler => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Error in event handler for ${eventType}:`, error);
      }
    });
  }
}
```

4. The game listens for events and reacts accordingly. For example, when the game ends:
```typescript
this.eventService.subscribe(EventType.GAME_ENDED, async (payload) => {
  if (this.state.userId && this.state.score > 0) {
    try {
      await this.dbService.saveScore(this.state.userId, this.state.score);
      this.eventService.publish(EventType.SCORE_SAVED, {
        userId: this.state.userId,
        score: this.state.score
      });
    } catch (error) {
      console.error('Error saving score:', error);
    }
  }
});
```

This event-driven architecture allows for loose coupling between components, making the system more maintainable and extensible. Events flow through the system to trigger actions without direct dependencies between components."

## 3. Interoperability (2.5 minutes)

"Interoperability is demonstrated through multiple integrations in the system:

1. The Banana API integration to fetch game questions:
```typescript
async getQuestion(): Promise<BananaResponse> {
  try {
    const response = await axios.get(this.baseUrl);
    console.log('Banana API Question Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching question:', error);
    throw error;
  }
}
```

2. SQLite database integration for user data:
```typescript
async initialize(): Promise<void> {
  // Open database
  this.db = await open({
    filename: './game_database.sqlite',
    driver: sqlite3.Database
  });

  // Create tables if they don't exist
  await this.db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      score INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id)
    );
  `);
}
```

3. JSON Web Token (JWT) for authentication:
```typescript
generateToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id as number,
    username: user.username
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
```

4. Frontend-Backend communication through RESTful APIs:
```javascript
async function login() {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Process login data
    }
  } catch (error) {
    console.error('Login error:', error);
  }
}
```

These examples demonstrate how our application seamlessly interoperates with different systems and protocols, all while maintaining clean separation of concerns."

## 4. Virtual Identity (2 minutes)

"I've implemented a comprehensive virtual identity system with user authentication and session management:

1. User registration and authentication:
```typescript
async registerUser(username: string, password: string): Promise<{ token: string } | null> {
  // First check if user exists
  const existingUser = await this.dbService.getUserByUsername(username);
  if (existingUser) {
    return null; // User already exists
  }

  // Create new user
  const user = await this.dbService.createUser(username, password);
  if (!user || !user.id) {
    return null;
  }

  // Generate token
  const token = this.generateToken(user);
  return { token };
}
```

2. Secure password handling with bcrypt hashing:
```typescript
async createUser(username: string, password: string): Promise<User | null> {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert the user into the database
    const result = await this.db!.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );
    
    // Return the user object
    return {
      id: result.lastID,
      username,
      password: hashedPassword
    };
  } catch (error) {
    return null;
  }
}
```

3. Authentication flow in the frontend:
```javascript
// Initial setup
function initialize() {
  // Check for existing token in localStorage
  token = localStorage.getItem('token');
  username = localStorage.getItem('username');
  userId = localStorage.getItem('userId');
  
  if (token && userId) {
    showGameContainer();
    loadUserData();
    loadLeaderboard();
  } else {
    showLoginContainer();
  }
}
```

4. Token-based authentication middleware:
```javascript
// Authentication middleware
const authenticate = (req, res, next) => {
  // Skip authentication for public routes
  const publicRoutes = ['/', '/api/auth/register', '/api/auth/login'];
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  // Get token from header or cookie
  const token = req.headers.authorization?.split(' ')[1] || req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = authService.verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Add user data to request
  req.user = payload;
  next();
}
```

5. User-specific leaderboard implementation:
```javascript
async function loadLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard', {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    
    if (data.success && data.highScores) {
      // Add each score to the leaderboard
      data.highScores.forEach((entry, index) => {
        const row = document.createElement('tr');
        
        // Highlight current user
        if (entry.username === username) {
          playerCell.style.fontWeight = 'bold';
          row.style.backgroundColor = '#fff9e6';
        }
        
        // Add to leaderboard
        leaderboardBody.appendChild(row);
      });
    }
  } catch (error) {
    console.error('Error loading leaderboard:', error);
  }
}
```

This comprehensive approach to identity management ensures secure user authentication, personalized game experiences, and persistent user data, which are key elements of virtual identity in distributed systems."

## Conclusion (1 minute)

"In conclusion, this implementation demonstrates key principles of distributed systems and software architecture:
- Low coupling and high cohesion through well-structured components
- Event-driven programming with a centralized event service
- Interoperability through multiple system integrations
- Virtual identity through secure user management and authentication

The system architecture I've implemented is highly maintainable and scalable due to the clear separation of concerns. The user authentication system provides security through industry-standard practices like password hashing and JWT tokens. The event-driven approach allows components to communicate without tight coupling.

Each of these architectural decisions contributes to a robust, secure, and user-friendly game application that demonstrates important concepts in distributed systems architecture. Thank you for watching!" 