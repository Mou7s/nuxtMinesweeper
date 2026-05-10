import { globalGameServer } from '../utils/gameLogic';
import { verifyToken } from '../utils/jwt';

export default defineWebSocketHandler({
  async open(peer) {
    console.log('[ws] Client connected:', peer.id);
    await globalGameServer.ensureInitialized();
    peer.subscribe('minesweeper');
    
    const snapshot = globalGameServer.getSnapshot();
    peer.send(JSON.stringify({ type: 'init', data: snapshot }));
  },
  
  async message(peer, message) {
    try {
      await globalGameServer.ensureInitialized();
      const msg = JSON.parse(message.text());
      
      // 身份识别：登录后前端会发送 JWT token
      if (msg.type === 'identify') {
        const { token } = msg.payload;
        const payload = verifyToken(token);
        if (!payload) {
          peer.send(JSON.stringify({ type: 'error', message: '身份验证失败，请重新登录' }));
          return;
        }
        const userId = payload.userId;
        (peer as any)._userId = userId;
        (peer as any)._username = payload.username;
        await globalGameServer.addPlayer(userId);
        
        // 广播排行榜更新
        const updatePayload = JSON.stringify({
          type: 'update',
          data: { state: globalGameServer.state, updates: [] }
        });
        peer.publish('minesweeper', updatePayload);
        peer.send(updatePayload);
        return;
      }

      if (msg.type === 'action') {
        const userId = (peer as any)._userId;
        if (!userId) {
          peer.send(JSON.stringify({ type: 'error', message: '请先登录后再进行操作' }));
          return;
        }

        const { action, x, y } = msg.payload;
        const result = await globalGameServer.processAction(action, x, y, userId);
        
        if (result) {
          const updatePayload = JSON.stringify({ type: 'update', data: result });
          peer.publish('minesweeper', updatePayload);
          peer.send(updatePayload);
        }
      }

      if (msg.type === 'cursor') {
        const userId = (peer as any)._userId;
        if (!userId) return; // 没登录不显示光标

        const username = (peer as any)._username || userId;
        const player = globalGameServer.state.leaderboard.find(p => p.username === username);
        
        const { x, y } = msg.payload;
        peer.publish('minesweeper', JSON.stringify({
          type: 'cursor',
          payload: {
            userId: userId,
            username,
            x, y,
            color: player?.color || '#3b82f6'
          }
        }));
      }

    } catch (e) {
      console.error('[ws] Error:', e);
    }
  },
  
  close(peer) {
    console.log('[ws] Client disconnected:', peer.id);
  }
});
