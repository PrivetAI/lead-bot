import express from 'express';
import cors from 'cors';
import { CalendarService } from './calendar';
import { MCPServer } from './mcp-server';

const app = express();
app.use(cors());
app.use(express.json());

const calendarService = new CalendarService();
const mcpServer = new MCPServer(calendarService);

app.post('/mcp/call', async (req, res) => {
  try {
    const { method, params } = req.body;
    const result = await mcpServer.handleCall(method, params);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}); 

app.get('/calendar/free-slots', async (req, res) => {
  try {
    const { date, duration = 60 } = req.query;
    const slots = await calendarService.getFreeSlots(
      date as string, 
      parseInt(duration as string)
    );
    res.json({ slots });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/calendar/create-event', async (req, res) => {
  try {
    const { title, startTime, endTime, attendeeEmail, leadId } = req.body;
    const event = await calendarService.createEvent({
      title,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      attendeeEmail,
      leadId
    });
    res.json({ event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.MCP_SERVER_PORT || 8080;
app.listen(PORT, () => {
  console.log(`MCP Calendar Server running on port ${PORT}`);
});