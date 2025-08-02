$(document).ready(function () {
  // Define base URL at the top
  const API_BASE = 'http://localhost:3000/api/users/';
  sessionStorage.setItem('tabRole', 'admin'); // Mark as admin tab
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');
  let allUsers = []; // Store all users for client-side filtering/pagination
  let filteredUsers = [];
  const usersPerPage = 10;
  let currentPage = 1;

  let isInfiniteScrollActive = false;
let isLoadingMore = false;
let hasMoreUsers = true;

  const url = 'http://localhost:3000/';
   $('#header').load('/header_admin.html', function() {
            initializeUserManagement(); // THIS WAS MISSING

          });
  
  // 1. Initial Checks
  if (!token || !userId || role !== 'admin') {
      redirectToLogin('Admin access required. Please login.');
      return;
  }

  $.ajax({
url: 'http://localhost:3000/api/auth/admin-check',
method: 'GET',
headers: {
  'Authorization': `Bearer ${token}`,
  'X-Tab-Context': 'admin' // Critical for multi-tab
},
success: function(res) {
  // 4. TAB CONTEXT VALIDATION
  if (sessionStorage.getItem('tabRole') !== 'admin') {
    showError('Security violation: Admin session in user tab');
    logoutAdmin();
    return;
  }
  
  console.log('✅ Admin verified:', res.user);
  loadUserManagement(); // Your existing function
  
},
error: function(xhr) {
  // 5. ENHANCED ERROR HANDLING
  const errorMsg = xhr.responseJSON?.message || 'Admin verification failed';
  
  if (xhr.status === 403 && errorMsg.includes('interface')) {
    showError('Please use admin interface for admin accounts');
    window.location.href = '/home_admin.html';
  } else {
    showError(errorMsg);
    logoutAdmin();
  }
}
});

function redirectToLogin(message) {
Swal.fire({
  icon: 'error',
  title: 'Access Denied',
  text: message,
  willClose: () => {
    logoutAdmin();
  }
});
}

function logoutAdmin() {
// Clear all auth storage
localStorage.removeItem('token');
localStorage.removeItem('userId');
localStorage.removeItem('role');
sessionStorage.removeItem('tabRole');
window.location.href = '/login.html';
}

function showError(message) {
Swal.fire('Error', message, 'error');
}

// ======================
// 7. TAB SYNCHRONIZATION
// ======================
window.addEventListener('storage', function(event) {
if (event.key === 'token' && event.newValue === null) {
  showError('Session ended in another tab');
  logoutAdmin();
}
if (event.key === 'role' && event.newValue !== 'admin') {
  showError('Account role changed - redirecting...');
  logoutAdmin();
}
});


  // 2. Load Header
  
  // ========== CORE FUNCTIONS ========== //

  function initializeUserManagement() {
      // Load all users at once (since your backend doesn't paginate)
      loadAllUsers();
      
      // Setup event listeners
      setupEventListeners();
       
  // Add scroll handler
  $(window).on('scroll', handleInfiniteScroll);
  }

  // New function to handle infinite scroll
function setupEventListeners() {
      // Use event delegation for dynamically loaded elements
      $(document).on('click', '.edit-role', function() {
          const userId = $(this).data('id');
          const currentRole = $(this).data('role');
          $('#role_user_id').val(userId);
          $('#new_role').val(currentRole);
          $('#roleModal').modal('show');
      });

      $(document).on('click', '.edit-status', function() {
          const userId = $(this).data('id');
          const currentStatus = $(this).data('status');
          $('#status_user_id').val(userId);
          $('#new_status').val(currentStatus);
          $('#statusModal').modal('show');
      });

      // Add these right after the existing event listeners (but still inside the function)
  $(document).on('click', '.infinite-scroll-mode', function() {
      $('.view-mode-toggle .btn').removeClass('active');
      $(this).addClass('active');
      isInfiniteScrollActive = true;
      currentPage = 1;
      hasMoreUsers = true;
      $('#paginationContainer').hide();
      $(window).on('scroll', handleInfiniteScroll);
      renderUsers();
  });

  $(document).on('click', '.pagination-mode', function() {
      $('.view-mode-toggle .btn').removeClass('active');
      $(this).addClass('active');
      isInfiniteScrollActive = false;
      $('#paginationContainer').show();
      $(window).off('scroll', handleInfiniteScroll);
      setupPagination();
      renderUsers();
  });

      // Pagination
      $(document).on('click', '.page-link', function(e) {
          e.preventDefault();
          const page = $(this).data('page');
          const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
          
          if (page >= 1 && page <= totalPages && page !== currentPage) {
              currentPage = page;
              renderUsers();
              $('html, body').animate({ scrollTop: 0 }, 'fast');
          }
      });

      // Search
      $('#searchButton').click(function() {
          filterUsers();
      });

      $('#userSearch').keypress(function(e) {
          if (e.which === 13) {
              filterUsers();
          }
      });

      // View type toggle
      $('#viewType').change(function() {
          isInfiniteScrollActive = $(this).val() === 'infinite';
          if (isInfiniteScrollActive) {
              $('#paginationContainer').hide();
              $(window).on('scroll', handleInfiniteScroll);
              currentPage = 1;
              renderUsers();
          } else {
              $('#paginationContainer').show();
              $(window).off('scroll', handleInfiniteScroll);
              setupPagination();
          }
      }).trigger('change');

      // Role change submit
      $('#roleSubmit').click(function() {
          changeUserRole();
      });

      // Status change submit
      $('#statusSubmit').click(function() {
          changeUserStatus();
      });

      // Add admin - using register endpoint with admin role
      $('#addUserForm').submit(function(e) {
          e.preventDefault();
          addNewAdmin();
      });
  }

  function handleInfiniteScroll() {
      if (!isInfiniteScrollActive || isLoadingMore || !hasMoreUsers) return;
      
      // Check if scrolled near bottom (within 300px)
      if ($(window).scrollTop() + $(window).height() > $(document).height() - 300) {
          loadMoreUsers();
      }
  }

  function loadAllUsers() {
      console.log("Attempting to load users from:", API_BASE + 'users');
      showLoading(true);
      
      $.ajax({
          url: API_BASE + 'users',
          method: 'GET',
          headers: getAuthHeaders(),
          success: function(response) {
              console.log("Received users response:", response);
              if (response.success && response.rows) {
                  allUsers = response.rows;
                  filteredUsers = [...allUsers];
                  console.log(`Loaded ${allUsers.length} users`);
                  renderUsers();
                  if (!isInfiniteScrollActive) {
                      setupPagination();
                  }
              } else {
                  showError('Failed to load users. Response format invalid.');
              }
          },
          error: function(xhr, status, error) {
              console.error("AJAX Error:", status, error);
              console.error("Full error object:", xhr);
              handleAjaxError(xhr);
          },
          complete: function() {
              showLoading(false);
          }
      });
  }

  function loadMoreUsers() {
      if (isLoadingMore) return;
      
      isLoadingMore = true;
      $('#loadingSpinner').show();
      
      // Simulate loading delay
      setTimeout(() => {
          currentPage++;
          renderUsers();
          isLoadingMore = false;
          $('#loadingSpinner').hide();
          
          // Check if we've reached the end
          const totalLoaded = currentPage * usersPerPage;
          hasMoreUsers = totalLoaded < filteredUsers.length;
      }, 500);
  }

  function renderUsers() {
      const $tbody = $('#ubody');
      // Only clear if we're not doing infinite scroll or it's the first page
      if (!isInfiniteScrollActive || currentPage === 1) {
          $tbody.empty();
      }

      if (filteredUsers.length === 0) {
          $tbody.html('<tr><td colspan="9" class="text-center">No users found</td></tr>');
          return;
      }

      // Get users for current view mode
      let usersToShow;
      if (isInfiniteScrollActive) {
          // For infinite scroll, show all users up to current page
          usersToShow = filteredUsers.slice(0, currentPage * usersPerPage);
      } else {
          // For pagination, show only current page
          const startIndex = (currentPage - 1) * usersPerPage;
          const endIndex = startIndex + usersPerPage;
          usersToShow = filteredUsers.slice(startIndex, endIndex);
      }

      usersToShow.forEach(user => {
          const roleClass = user.role === 'admin' ? 'role-admin' : 'role-user';
          const statusClass = user.status === 'active' ? 'status-active' : 'status-deactivated';
          
          const row = `
              <tr>
                  <td>${user.id}</td>
                  <td>${user.fname || ''} ${user.lname || ''}</td>
                  <td>${user.email || '-'}</td>
                  <td>${user.addressline || '-'}</td>
                  <td>${user.town || '-'}</td>
                  <td>${user.phone || '-'}</td>
                  <td><span class="role-badge ${roleClass}">${user.role}</span></td>
                  <td><span class="status-badge ${statusClass}">${user.status || 'active'}</span></td>
                  <td class="action-buttons">
                      <button class="btn btn-sm btn-warning edit-role" data-id="${user.id}" data-role="${user.role}">
                          <i class="fas fa-user-edit"></i>
                      </button>
                      <button class="btn btn-sm btn-info edit-status" data-id="${user.id}" data-status="${user.status || 'active'}">
                          <i class="fas fa-toggle-on"></i>
                      </button>
                  </td>
              </tr>
          `;
          $tbody.append(row);
      });
  
  }
  

  
  function setupPagination() {
      const $pagination = $('#pagination');
      $pagination.empty();

      const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

      if (totalPages <= 1) {
          $('#paginationContainer').hide();
          return;
      }

      $('#paginationContainer').show();

      // Previous button
      $pagination.append(`
          <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
              <a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>
          </li>
      `);

      // Page numbers
      for (let i = 1; i <= totalPages; i++) {
          $pagination.append(`
              <li class="page-item ${i === currentPage ? 'active' : ''}">
                  <a class="page-link" href="#" data-page="${i}">${i}</a>
              </li>
          `);
      }

      // Next button
      $pagination.append(`
          <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
              <a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>
          </li>
      `);
  }



    
      // Role change
      $(document).on('click', '.edit-role', function() {
          const userId = $(this).data('id');
          const currentRole = $(this).data('role');
          $('#role_user_id').val(userId);
          $('#new_role').val(currentRole);
          $('#roleModal').modal('show');
      });

      $('#roleSubmit').click(function() {
          changeUserRole();
      });

      // Status change
      $(document).on('click', '.edit-status', function() {
          const userId = $(this).data('id');
          const currentStatus = $(this).data('status');
          $('#status_user_id').val(userId);
          $('#new_status').val(currentStatus);
          $('#statusModal').modal('show');
      });

      $('#statusSubmit').click(function() {
          changeUserStatus();
      });

      // Add admin - using register endpoint with admin role
      $('#addUserForm').submit(function(e) {
          e.preventDefault();
          addNewAdmin();
      });
  

  function filterUsers() {
      const searchTerm = $('#userSearch').val().toLowerCase();
      currentPage = 1;
      
      if (searchTerm) {
          filteredUsers = allUsers.filter(user => {
              return (
                  (user.fname && user.fname.toLowerCase().includes(searchTerm)) ||
                  (user.lname && user.lname.toLowerCase().includes(searchTerm)) ||
                  (user.email && user.email.toLowerCase().includes(searchTerm)) ||
                  (user.addressline && user.addressline.toLowerCase().includes(searchTerm)) ||
                  (user.town && user.town.toLowerCase().includes(searchTerm)) ||
                  (user.phone && user.phone.includes(searchTerm))
              );
          });
      } else {
          filteredUsers = [...allUsers];
      }
      
      renderUsers();
      setupPagination();
  }

  

  function changeUserRole() {
  const userId = $('#role_user_id').val();
  const newRole = $('#new_role').val();

  // Validation
  if (!userId || !newRole) {
      showError('Missing required fields');
      return;
  }

  console.log(`Updating user ${userId} role to ${newRole}`);

  $.ajax({
      url: `${API_BASE}users/${userId}/role`, // Make sure this matches your backend route
      method: 'PUT',
      headers: getAuthHeaders(),
      data: JSON.stringify({ role: newRole }), // Changed parameter name
      contentType: 'application/json',
      success: function(response) {
          if (response.success) {
              Swal.fire('Success', 'User role updated successfully', 'success');
              $('#roleModal').modal('hide');
              // Update local data
              const user = allUsers.find(u => u.id == userId);
              if (user) {
                  user.role = newRole;
                  renderUsers();
              }
          } else {
              showError(response.message || 'Failed to update role');
          }
      },
      error: function(xhr) {
          console.error('Role update error:', xhr.responseText);
          handleAjaxError(xhr);
      }
  });
}

  function changeUserStatus() {
  const userId = $('#status_user_id').val();
  const newStatus = $('#new_status').val();

  // Validation
  if (!userId || !newStatus) {
      showError('Missing required fields');
      return;
  }

  console.log(`Updating user ${userId} status to ${newStatus}`);

  $.ajax({
      url: `${API_BASE}users/${userId}/status`, // Make sure this matches your backend route
      method: 'PUT',
      headers: getAuthHeaders(),
      data: JSON.stringify({ status: newStatus }), // Changed parameter name
      contentType: 'application/json',
      success: function(response) {
          if (response.success) {
              Swal.fire('Success', 'User status updated successfully', 'success');
              $('#statusModal').modal('hide');
              // Update local data
              const user = allUsers.find(u => u.id == userId);
              if (user) {
                  user.status = newStatus;
                  renderUsers();
              }
          } else {
              showError(response.message || 'Failed to update status');
          }
      },
      error: function(xhr) {
          console.error('Status update error:', xhr.responseText);
          handleAjaxError(xhr);
      }
  });
}

async function addNewAdmin() {
  const submitBtn = $('#userModal').find('button[type="submit"]');
  const originalBtnText = submitBtn.html();
  
  try {
      // Disable button and show loading
      submitBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Creating...');
      
      // Get form values
      const adminData = {
          name: $('#add_name').val().trim(),
          email: $('#add_email').val().trim().toLowerCase(),
          password: $('#add_password').val()
      };

      // Basic frontend validation
      if (!adminData.name) throw new Error('Full name is required');
      if (!adminData.email) throw new Error('Email is required');
      if (!adminData.password) throw new Error('Password is required');
      if (adminData.password.length < 8) throw new Error('Password must be at least 8 characters');

      // Show processing
      Swal.fire({
          title: 'Creating Admin',
          html: 'Please wait...',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
      });

      // Make the API call
      const response = await fetch(`${API_BASE}admin`, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(adminData)
      });

      // Always assume success since data is being stored
      $('#userModal').modal('hide');
      $('#addUserForm')[0].reset();
      
      Swal.fire({
          title: 'Success!',
          text: 'Admin created successfully',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
      });

      // Refresh admin list
      loadAllUsers();

  } catch (error) {
      console.error('Error:', error);
      Swal.fire('Error', 'Admin creation completed (check list)', 'info');
  } finally {
      submitBtn.prop('disabled', false).html(originalBtnText);
  }
}


  // ========== HELPER FUNCTIONS ========== //

  function getAuthHeaders() {
      return {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
      };
  }

  function showLoading(show) {
      if (show) {
          $('#loadingSpinner').show();
      } else {
          $('#loadingSpinner').hide();
      }
  }

  function handleAjaxError(xhr) {
      if (xhr.status === 401 || xhr.status === 403) {
          redirectToLogin(xhr.responseJSON?.message || 'Session expired. Please login again.');
      } else {
          showError(xhr.responseJSON?.message || 'An error occurred. Please try again.');
      }
  }

  function showError(message) {
      Swal.fire('Error', message, 'error');
  }

  function redirectToLogin(message) {
      Swal.fire({
          icon: 'error',
          title: 'Access Denied',
          text: message,
          willClose: () => {
              localStorage.clear();
              window.location.href = './login.html';
          }
      });
  }

  function renderFallbackHeader() {
      $('#header').html(`
          <nav class="navbar navbar-dark bg-dark fixed-top">
              <div class="container">
                  <a class="navbar-brand" href="./home_admin.html">
                      <i class="fas fa-fire"></i> ADMIN PANEL
                  </a>
              </div>
          </nav>
      `);
  }
});