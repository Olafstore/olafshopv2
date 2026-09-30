(() => {
  let rows = [];
  let failed = false;
  window.OlafProductDownloads = {
    async refresh() {
      rows = []; failed = false;
      try {
        const { data, error } = await window.olafSupabase.rpc('my_order_downloads');
        if (error) throw error;
        rows = (Array.isArray(data) ? data : []).filter(row => window.OlafDownloadDelivery.parse(row.payload));
      } catch (error) {
        failed = true;
        console.warn('Order downloads unavailable', error.code);
      }
    },
    item(id) { return rows.find(row => String(row.itemId) === String(id))?.payload || ''; },
    render(order) {
      if (order.paymentStatus !== 'verified' || !['confirmed', 'delivered'].includes(order.status)) return '';
      if (failed) return '<p role="status">โหลดลิงก์ดาวน์โหลดไม่สำเร็จ กรุณารีเฟรชหน้า หรือติดต่อร้าน</p>';
      return rows.filter(row => row.orderId === order.id).map(row => window.OlafDownloadDelivery.render(row.payload)).join('');
    }
  };
})();
