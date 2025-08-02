$(document).ready(function() {
    // ========== AUTHENTICATION CHECK ========== //
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role') || localStorage.getItem('userRole');
    
    // Check if user is logged in and is admin
    if (!token) {
        alert('Please log in to access this page.');
        window.location.href = '/login.html';
        return;
    }
    
    if (!role || role.toLowerCase() !== 'admin') {
        alert('Admin access required.');
        window.location.href = '/index.html';
        return;
    }

    let categoryTable;
    let isEditMode = false;
    let editingCategoryId = null;
    let categoryFormValidator;

    // Initialize DataTable with infinite scroll
    categoryTable = $('#ctable').DataTable({
        "processing": true,
        "serverSide": false,
        "paging": false, // Disable pagination
        "info": false, // Hide "Showing X of Y entries" info
        "lengthChange": false, // Hide page length selector
        "searching": true,
        "ajax": {
            "url": "/api/category/admin/all",
            "type": "GET",
            "beforeSend": function(xhr) {
                xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            },
            "data": function(d) {
                return {
                    page: 1,
                    limit: 20
                };
            },
            "dataSrc": function(json) {
                if (json.success) {
                    // Store pagination info for infinite scroll
                    window.paginationInfo = json.pagination;
                    return json.data;
                } else {
                    console.error('Error loading categories:', json.error);
                    return [];
                }
            },
            "error": function(xhr, error, thrown) {
                console.error('AJAX Error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to load categories. Please try again.'
                });
            }
        },
        "columns": [
            { 
                "data": "category_id", 
                "title": "ID",
                "render": function(data, type, row) {
                    if (row.deleted_at) {
                        return `<span class="text-muted">${data}</span>`;
                    }
                    return data;
                }
            },
            { 
                "data": "description", 
                "title": "Description",
                "render": function(data, type, row) {
                    if (row.deleted_at) {
                        return `<span class="text-muted text-decoration-line-through">${data}</span>`;
                    }
                    return data;
                }
            },
            {
                "data": null,
                "title": "Actions",
                "orderable": false,
                "render": function(data, type, row) {
                    if (row.deleted_at) {
                        // Show restore button for deleted categories
                        return `
                            <button class="btn btn-sm btn-success restore-btn" data-id="${row.category_id}" data-description="${row.description}">
                                <i class="fas fa-undo"></i> Restore
                            </button>
                        `;
                    } else {
                        // Show edit and delete buttons for active categories
                        return `
                            <button class="btn btn-sm btn-info edit-btn" data-id="${row.category_id}" data-description="${row.description}">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-danger delete-btn" data-id="${row.category_id}">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        `;
                    }
                }
            }
        ],
        "dom": 'Bfrtip',
        "buttons": [
            {
                "text": '<i class="fas fa-plus"></i> Add Category',
                "className": 'btn btn-primary',
                "action": function(e, dt, node, config) {
                    openAddModal();
                }
            },
            'excel',
            'pdf'
        ],
        "responsive": true,
        "order": [[1, 'asc']],
        "createdRow": function(row, data, dataIndex) {
            if (data.deleted_at) {
                $(row).addClass('deleted-row');
            }
        }
    });

    // Initialize jQuery Validation for Category Form
    categoryFormValidator = $('#cform').validate({
        rules: {
            description: {
                required: true,
                minlength: 2,
                maxlength: 100
                // Removed pattern validation to be more permissive
            }
        },
        messages: {
            description: {
                required: "Please enter a category description",
                minlength: "Description must be at least 2 characters long",
                maxlength: "Description cannot exceed 100 characters"
            }
        },
        errorElement: 'div',
        errorClass: 'invalid-feedback',
        errorPlacement: function(error, element) {
            error.insertAfter(element);
        },
        highlight: function(element, errorClass, validClass) {
            $(element).addClass('is-invalid').removeClass('is-valid');
        },
        unhighlight: function(element, errorClass, validClass) {
            $(element).removeClass('is-invalid').addClass('is-valid');
        },
        submitHandler: function(form) {
            // This will be handled by the button click events
            return false;
        }
    });

    // Open Add Modal
    function openAddModal() {
        isEditMode = false;
        editingCategoryId = null;
        $('#categoryModalLabel').text('Add Category');
        $('#cform')[0].reset();
        categoryFormValidator.resetForm();
        $('#category_description').removeClass('is-valid is-invalid');
        $('#categorySubmit').show();
        $('#categoryUpdate').hide();
        $('#categoryModal').modal('show');
    }

    // Open Edit Modal
    function openEditModal(categoryId, description) {
        isEditMode = true;
        editingCategoryId = categoryId;
        $('#categoryModalLabel').text('Edit Category');
        categoryFormValidator.resetForm();
        $('#category_description').removeClass('is-valid is-invalid');
        $('#category_description').val(description);
        // Validate the field after setting the value to ensure proper state
        categoryFormValidator.element('#category_description');
        $('#categorySubmit').hide();
        $('#categoryUpdate').show();
        $('#categoryModal').modal('show');
    }

    // Handle Edit Button Click
    $(document).on('click', '.edit-btn', function() {
        const categoryId = $(this).data('id');
        const description = $(this).data('description');
        openEditModal(categoryId, description);
    });

    // Handle Delete Button Click
    $(document).on('click', '.delete-btn', function() {
        const categoryId = $(this).data('id');
        deleteCategory(categoryId);
    });

    // Handle Restore Button Click
    $(document).on('click', '.restore-btn', function() {
        const categoryId = $(this).data('id');
        const description = $(this).data('description');
        restoreCategory(categoryId, description);
    });

    // Handle Save Button Click
    $('#categorySubmit').on('click', function() {
        // Validate the form using jQuery validation
        if (!categoryFormValidator.form()) {
            return;
        }

        const formData = {
            description: $('#category_description').val().trim()
        };

        $.ajax({
            url: '/api/category',
            type: 'POST',
            data: JSON.stringify(formData),
            contentType: 'application/json',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            success: function(response) {
                if (response.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: 'Category created successfully!'
                    }).then(() => {
                        $('#categoryModal').modal('hide');
                        // Reset pagination state and reload
                        currentPage = 1;
                        hasMoreData = true;
                        categoryTable.ajax.reload();
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: response.error || 'Failed to create category'
                    });
                }
            },
            error: function(xhr, status, error) {
                console.error('Error creating category:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to create category. Please try again.'
                });
            }
        });
    });

    // Handle Update Button Click
    $('#categoryUpdate').on('click', function() {
        // Debug: Log the current value and validation state
        const currentValue = $('#category_description').val();
        console.log('Current description value:', currentValue);
        console.log('Value length:', currentValue.length);
        
        // Validate the form using jQuery validation
        if (!categoryFormValidator.form()) {
            console.log('Form validation failed');
            return;
        }

        // Additional manual validation check
        const trimmedValue = $('#category_description').val().trim();
        if (!trimmedValue || trimmedValue.length < 2) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please enter a valid category description (at least 2 characters).'
            });
            return;
        }

        const formData = {
            description: trimmedValue
        };

        $.ajax({
            url: `/api/category/${editingCategoryId}`,
            type: 'PUT',
            data: JSON.stringify(formData),
            contentType: 'application/json',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            success: function(response) {
                if (response.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: 'Category updated successfully!'
                    }).then(() => {
                        $('#categoryModal').modal('hide');
                        // Reset pagination state and reload
                        currentPage = 1;
                        hasMoreData = true;
                        categoryTable.ajax.reload();
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: response.error || 'Failed to update category'
                    });
                }
            },
            error: function(xhr, status, error) {
                console.error('Error updating category:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to update category. Please try again.'
                });
            }
        });
    });

    // Delete Category Function
    function deleteCategory(categoryId) {
        Swal.fire({
            title: 'Are you sure?',
            text: "This will soft delete the category and all associated items!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: `/api/category/${categoryId}`,
                    type: 'DELETE',
                    headers: {
                        'Authorization': 'Bearer ' + token
                    },
                    success: function(response) {
                        if (response.success) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Deleted!',
                                text: response.message
                            }).then(() => {
                                // Reset pagination state and reload
                                currentPage = 1;
                                hasMoreData = true;
                                categoryTable.ajax.reload();
                            });
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: response.error || 'Failed to delete category'
                            });
                        }
                    },
                    error: function(xhr, status, error) {
                        console.error('Error deleting category:', error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: 'Failed to delete category. Please try again.'
                        });
                    }
                });
            }
        });
    }

    // Restore Category Function
    function restoreCategory(categoryId, description) {
        Swal.fire({
            title: 'Restore Category?',
            text: `Are you sure you want to restore "${description}"?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, restore it!'
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: `/api/category/restore/${categoryId}`,
                    type: 'PUT',
                    headers: {
                        'Authorization': 'Bearer ' + token
                    },
                    success: function(response) {
                        if (response.success) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Restored!',
                                text: response.message
                            }).then(() => {
                                // Reset pagination state and reload
                                currentPage = 1;
                                hasMoreData = true;
                                categoryTable.ajax.reload();
                            });
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: response.error || 'Failed to restore category'
                            });
                        }
                    },
                    error: function(xhr, status, error) {
                        console.error('Error restoring category:', error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: 'Failed to restore category. Please try again.'
                        });
                    }
                });
            }
        });
    }

    // Reset form when modal is closed
    $('#categoryModal').on('hidden.bs.modal', function() {
        $('#cform')[0].reset();
        categoryFormValidator.resetForm();
        $('#category_description').removeClass('is-valid is-invalid');
        isEditMode = false;
        editingCategoryId = null;
    });

    // Handle Enter key in form
    $('#categoryModal').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            if (isEditMode) {
                $('#categoryUpdate').click();
            } else {
                $('#categorySubmit').click();
            }
        }
    });

    // Real-time validation feedback
    $('#category_description').on('input blur', function() {
        if (categoryFormValidator) {
            categoryFormValidator.element(this);
        }
    });

    // Debug: Add a test button to check validation (remove this later)
    $('#category_description').on('keyup', function() {
        const value = $(this).val();
        console.log('Input value:', value, 'Length:', value.length, 'Valid:', categoryFormValidator.element(this));
    });

    // Prevent form submission on Enter key in input field
    $('#category_description').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            e.preventDefault();
            if (isEditMode) {
                $('#categoryUpdate').click();
            } else {
                $('#categorySubmit').click();
            }
        }
    });

    // Infinite Scroll Implementation
    let isLoading = false;
    let currentPage = 1;
    let hasMoreData = true;

    // Function to load more data
    function loadMoreData() {
        if (isLoading || !hasMoreData) return;

        isLoading = true;
        currentPage++;
        
        // Show loading indicator
        const loadingRow = $(`
            <tr class="loading-row">
                <td colspan="3" class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                    <span class="ml-2">Loading more categories...</span>
                </td>
            </tr>
        `);
        
        $('#ctable tbody').append(loadingRow);

        // Load more data from API
        $.ajax({
            url: '/api/category/admin/all',
            type: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            data: {
                page: currentPage,
                limit: 20
            },
            success: function(response) {
                if (response.success) {
                    // Remove loading row
                    $('.loading-row').remove();
                    
                    // Add new rows to the table
                    if (response.data && response.data.length > 0) {
                        response.data.forEach(function(category) {
                            const row = createTableRow(category);
                            $('#ctable tbody').append(row);
                        });
                    }
                    
                    // Update pagination info
                    hasMoreData = response.pagination.hasMore;
                    
                    // Hide load more button if no more data
                    if (!hasMoreData) {
                        $('.load-more-btn').hide();
                    }
                } else {
                    $('.loading-row').remove();
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: response.error || 'Failed to load more categories'
                    });
                }
                isLoading = false;
            },
            error: function(xhr, status, error) {
                $('.loading-row').remove();
                console.error('Error loading more categories:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to load more categories. Please try again.'
                });
                isLoading = false;
            }
        });
    }

    // Function to create table row
    function createTableRow(category) {
        let actions = '';
        if (category.deleted_at) {
            actions = `
                <button class="btn btn-sm btn-success restore-btn" data-id="${category.category_id}" data-description="${category.description}">
                    <i class="fas fa-undo"></i> Restore
                </button>
            `;
        } else {
            actions = `
                <button class="btn btn-sm btn-info edit-btn" data-id="${category.category_id}" data-description="${category.description}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger delete-btn" data-id="${category.category_id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            `;
        }

        const row = $(`
            <tr class="${category.deleted_at ? 'deleted-row' : ''}">
                <td>${category.deleted_at ? `<span class="text-muted">${category.category_id}</span>` : category.category_id}</td>
                <td>${category.deleted_at ? `<span class="text-muted text-decoration-line-through">${category.description}</span>` : category.description}</td>
                <td>${actions}</td>
            </tr>
        `);
        
        return row;
    }

    // Scroll event handler for infinite scroll
    $(window).on('scroll', function() {
        if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            loadMoreData();
        }
    });

    // Add a "Load More" button at the bottom of the table
    function addLoadMoreButton() {
        // Remove existing button if any
        $('.load-more-btn').remove();
        
        const loadMoreBtn = $(`
            <div class="text-center mt-3">
                <button class="btn btn-primary load-more-btn" id="loadMoreBtn">
                    <i class="fas fa-spinner fa-spin" style="display: none;"></i>
                    Load More Categories
                </button>
            </div>
        `);
        
        $('.dataTables_wrapper').append(loadMoreBtn);
        
        $('#loadMoreBtn').on('click', function() {
            const btn = $(this);
            const spinner = btn.find('.fa-spinner');
            
            btn.prop('disabled', true);
            spinner.show();
            
            loadMoreData();
            
            // Re-enable button after loading
            setTimeout(() => {
                btn.prop('disabled', false);
                spinner.hide();
            }, 1000);
        });
    }

    // Initialize load more button after table is loaded
    categoryTable.on('draw', function() {
        if (window.paginationInfo && window.paginationInfo.hasMore) {
            addLoadMoreButton();
        }
    });
});