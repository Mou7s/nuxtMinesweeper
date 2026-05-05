import { globalGameServer } from '../utils/gameLogic';

export default defineWebSocketHandler({
  open(peer) {
    console.log('[ws] Client connected:', peer.id);
    
    // Join the global game channel
    peer.subscribe('minesweeper');
    
    // Send the current game snapshot to the newly connected player
    const snapshot = globalGameServer.getSnapshot();
    peer.send(JSON.stringify({
      type: 'init',
      data: snapshot
    }));
  },
  
  message(peer, message) {
    try {
      const msg = JSON.parse(message.text());
      
      if (msg.type === 'action') {
        const { action, x, y } = msg.payload;
        
        // Let the server process the logic
        const result = globalGameServer.processAction(action, x, y);
        
        if (result) {
          // If valid changes occurred, broadcast them to EVERYONE (including the sender)
          const updatePayload = JSON.stringify({
            type: 'update',
            data: result
          });
          
          peer.publish('minesweeper', updatePayload);
          peer.send(updatePayload); // publish sends to others, send sends to sender
        }
      }
    } catch (e) {
      console.error('[ws] Error processing message:', e);
    }
  },
  
  close(peer) {
    console.log('[ws] Client disconnected:', peer.id);
  }
});
