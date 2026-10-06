require('dotenv').config();
const path    = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors({ origin: /^http:\/\/localhost:\d+$/, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/environments', require('./routes/environments'));
app.use('/api/environments/:environmentId/permissions', require('./routes/permissions'));
app.use('/api/environments/:id/template', require('./routes/template'));
app.use('/api/environment-requests', require('./routes/environmentRequests'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/tasks/:taskId/messages', require('./routes/taskMessages'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/dev', require('./routes/dev'));

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(process.env.PORT || 5000, () =>
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
