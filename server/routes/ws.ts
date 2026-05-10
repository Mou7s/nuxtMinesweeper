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

        const player = globalGameServer.state.leaderboard.find(p => p.username === userId); // 这里假设 userId 就是 username，或者需要通过 userId 查 username
        // 实际上 identify 时已经把 userId 存到了 peer._userId
        // 最好是在 identify 时把完整 player 信息存下来或者能查到
        
        const { x, y } = msg.payload;
        peer.publish('minesweeper', JSON.stringify({
          type: 'cursor',
          payload: {
            userId: userId,
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
