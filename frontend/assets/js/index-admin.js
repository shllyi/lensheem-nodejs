$(document).ready(function () {
    const url = 'http://localhost:3000';
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
  
    $('#header').load('/header_admin.html');
  
    sessionStorage.setItem('tabRole', 'admin');
  
  // 2. Check for existing auth data
  
  // 3. Redirect if not logged in as admin
  if (!token || !role || role.toLowerCase() !== 'admin') {
    alert('Admins only. Please log in.');
    window.location.href = '/login.html';
    return;
  }
  
  // ======================
  // AJAX CONFIGURATION
  // ======================
  
  // 4. Configure all AJAX calls with auth headers
  $.ajax({
    url: url + '/api/auth/admin-check',
    method: 'GET',
    headers: { 
      'Authorization': 'Bearer ' + token,
      'X-Tab-Context': 'admin' // Explicit context
    },
    success: function(res) {
      console.log('✅ Admin verified:', res.user);
      
      // 6. Additional client-side context check
      if (sessionStorage.getItem('tabRole') !== 'admin') {
        alert('Security violation: Admin session in user tab');
        logoutUser();
        return;
      }
      
  
  
        // Load and render charts
        loadAddressChart();
        loadSalesChart();
        loadItemsChart();
     
      },
    error: function(xhr) {
      // 8. Enhanced error handling
      const errorMsg = xhr.responseJSON?.message;
      
      if (xhr.status === 403 && errorMsg?.includes('interface')) {
        // Admin trying to use wrong interface
        alert('Please use the admin interface for admin accounts');
        window.location.href = '/home_admin.html';
      } 
      else if (xhr.status === 401) {
        // Token expired or invalid
        alert('Session expired. Please login again');
        logoutUser();
      }
      else {
        // Generic error
        alert(errorMsg || 'Admin verification failed');
        logoutUser();
      }
    }
  });
  
  
  function logoutUser() {
    // Clear all auth data
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    sessionStorage.removeItem('tabRole');
    
    // Redirect to login
    window.location.href = '/login.html';
  }
  
  // 10. Tab synchronization handler
  window.addEventListener('storage', function(event) {
    // Logout if token is cleared in another tab
    if (event.key === 'token' && event.newValue === null) {
      alert('Your session was ended in another tab');
      logoutUser();
    }
    
    // Redirect if role changes in another tab
    if (event.key === 'role' && event.newValue && event.newValue.toLowerCase() !== 'admin') {
      alert('Account type changed - redirecting...');
      logoutUser();
    }
  });
  
  
    // Chart functions:
  
     function getRandomColors(count) {
      return Array.from({ length: count }, () => {
        let color = '#';
        const letters = '0123456789ABCDEF';
        for (let i = 0; i < 6; i++) {
          color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
      });
    }
  
    function loadAddressChart() {
      $.ajax({
        method: "GET",
        url: url + '/api/dashboard/address-chart',
        dataType: "json",
        headers: { Authorization: 'Bearer ' + token },
        success: function (data) {
          const rows = data.rows;
          const ctx = $("#addressChart")[0];
          const colors = getRandomColors(rows.length);
  
          if (window.addressChartInstance) window.addressChartInstance.destroy();
  
          window.addressChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: rows.map(r => r.addressline),
              datasets: [{
                label: 'Number of Customers per Town',
                data: rows.map(r => r.total),
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 1
              }]
            },
            options: {
              indexAxis: 'y',
              scales: {
                y: { beginAtZero: true }
              }
            }
          });
        },
        error: function (err) {
          console.error('Address chart error:', err);
        }
      });
    }
  
    function loadSalesChart() {
      $.ajax({
        method: "GET",
        url: url + '/api/dashboard/sales-chart',
        dataType: "json",
        headers: { Authorization: 'Bearer ' + token },
        success: function (data) {
          const rows = data.rows;
          const ctx = $("#salesChart")[0];
          const colors = getRandomColors(rows.length);
  
          if (window.salesChartInstance) window.salesChartInstance.destroy();
  
          window.salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
              labels: rows.map(r => r.month),
              datasets: [{
                label: 'Monthly Sales',
                data: rows.map(r => r.total),
                backgroundColor: colors,
                borderColor: colors,
                fill: false,
                borderWidth: 2,
                tension: 0.1
              }]
            },
            options: {
              scales: {
                y: { beginAtZero: true }
              }
            }
          });
        },
        error: function (err) {
          console.error('Sales chart error:', err);
        }
      });
    }
  
    function loadItemsChart() {
      $.ajax({
        method: "GET",
        url: url + '/api/dashboard/items-chart',
        dataType: "json",
        headers: { Authorization: 'Bearer ' + token },
        success: function (data) {
          const rows = data.rows;
          const ctx = $("#itemsChart")[0];
          const colors = getRandomColors(rows.length);
  
          if (window.itemsChartInstance) window.itemsChartInstance.destroy();
  
          window.itemsChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
              labels: rows.map(r => r.items),
              datasets: [{
                label: 'Number of Items Sold',
                data: rows.map(r => r.total),
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: { position: 'right' }
              }
            }
          });
        },
        error: function (err) {
          console.error('Items chart error:', err);
        }
      });
    }
  
    // Load all charts on page ready
    loadAddressChart();
    loadSalesChart();
    loadItemsChart();
  });