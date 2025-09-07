// 调试存储内容的脚本
// 在扩展的开发者工具控制台中运行此脚本

async function debugStorage() {
  try {
    console.log('🔍 开始检查存储内容...');
    
    // 获取所有存储的数据
    const allData = await chrome.storage.local.get(null);
    console.log('📦 存储的所有数据:', allData);
    
    // 检查书签
    const bookmarks = allData.bookmarks || [];
    console.log(`📚 书签数量: ${bookmarks.length}`);
    if (bookmarks.length > 0) {
      console.log('📖 前5个书签:', bookmarks.slice(0, 5));
    }
    
    // 检查文件夹
    const folders = allData.folders || [];
    console.log(`📁 文件夹数量: ${folders.length}`);
    console.log('📁 文件夹列表:', folders);
    
    // 检查设置
    const settings = allData.settings || {};
    console.log('⚙️ 设置:', settings);
    
    // 检查其他数据
    Object.keys(allData).forEach(key => {
      if (!['bookmarks', 'folders', 'settings'].includes(key)) {
        console.log(`🔧 其他数据 ${key}:`, allData[key]);
      }
    });
    
    return allData;
  } catch (error) {
    console.error('❌ 检查存储失败:', error);
    return null;
  }
}

// 测试浏览器书签API
async function testBookmarksAPI() {
  try {
    console.log('🔍 测试浏览器书签API...');
    
    // 检查权限
    const hasPermission = await chrome.permissions.contains({
      permissions: ['bookmarks']
    });
    console.log('🔐 书签权限:', hasPermission);
    
    if (!hasPermission) {
      console.error('❌ 没有书签权限');
      return;
    }
    
    // 获取书签树
    const tree = await chrome.bookmarks.getTree();
    console.log('📚 书签树:', tree);
    
    // 遍历并统计书签
    let bookmarkCount = 0;
    function countBookmarks(nodes) {
      nodes.forEach(node => {
        if (node.url) {
          bookmarkCount++;
        } else if (node.children) {
          countBookmarks(node.children);
        }
      });
    }
    
    countBookmarks(tree);
    console.log(`📊 浏览器中总共有 ${bookmarkCount} 个书签`);
    
    return tree;
  } catch (error) {
    console.error('❌ 测试书签API失败:', error);
    return null;
  }
}

// 清空存储（谨慎使用）
async function clearStorage() {
  if (confirm('确定要清空所有存储的数据吗？此操作不可撤销！')) {
    try {
      await chrome.storage.local.clear();
      console.log('✅ 存储已清空');
    } catch (error) {
      console.error('❌ 清空存储失败:', error);
    }
  }
}

// 手动触发同步
async function manualSync() {
  try {
    console.log('🔄 手动触发同步...');
    const response = await chrome.runtime.sendMessage({
      action: 'syncBrowserBookmarks'
    });
    console.log('📨 同步响应:', response);
  } catch (error) {
    console.error('❌ 手动同步失败:', error);
  }
}

console.log('🛠️ 调试工具已加载');
console.log('📋 可用命令:');
console.log('  debugStorage() - 检查存储内容');
console.log('  testBookmarksAPI() - 测试书签API');
console.log('  clearStorage() - 清空存储');
console.log('  manualSync() - 手动同步');
