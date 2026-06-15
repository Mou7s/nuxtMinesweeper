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
        (peer)._userId = userId;
        (peer)._username = payload.username;
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
        const userId = (peer)._userId;
        if (!userId) {
          peer.send(JSON.stringify({ type: 'error', message: '请先登录后再进行操作' }));
          return;
        }

        const startTime = performance.now();
        const { action, x, y } = msg.payload;
        const result = await globalGameServer.processAction(action, x, y, userId);
        const duration = performance.now() - startTime;
        
        if (result) {
          const updateCount = result.updates ? result.updates.length : 0;
          const updatePayload = JSON.stringify({ type: 'update', data: result });
          const payloadSize = updatePayload.length;

          if (payloadSize > 100 * 1024) {
            console.warn(`[ws-perf-server] Large message generated for action "${action}": ${(payloadSize / 1024).toFixed(2)}KB (exceeds 100KB)`);
          }
          if (updateCount > 500) {
            console.warn(`[ws-perf-server] Large update generated for action "${action}": ${updateCount} cells (exceeds 500)`);
          }
          if (duration > 50) {
            console.warn(`[ws-perf-server] Slow action execution for "${action}": ${duration.toFixed(2)}ms (exceeds 50ms)`);
          }

          peer.publish('minesweeper', updatePayload);
          peer.send(updatePayload);
        }
      }

      if (msg.type === 'cursor') {
        const userId = (peer)._userId;
        if (!userId) return; // 没登录不显示光标

        const username = (peer)._username || userId;
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
