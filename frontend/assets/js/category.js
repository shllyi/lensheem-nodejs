$(document).ready(function() {
    let categoryTable;
    let isEditMode = false;
    let editingCategoryId = null;

    // Initialize DataTable
    categoryTable = $('#ctable').DataTable({
        "processing": true,
        "serverSide": false,
        "ajax": {
            "url": "/api/category",
            "type": "GET",
            "dataSrc": function(json) {
                if (json.success) {
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
            { "data": "category_id", "title": "ID" },
            { "data": "description", "title": "Description" },
            {
                "data": null,
                "title": "Actions",
                "orderable": false,
                "render": function(data, type, row) {
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
        "pageLength": 10,
        "lengthMenu": [[10, 25, 50, -1], [10, 25, 50, "All"]],
        "order": [[1, 'asc']]
    });

    // Open Add Modal
    function openAddModal() {
        isEditMode = false;
        editingCategoryId = null;
        $('#categoryModalLabel').text('Add Category');
        $('#cform')[0].reset();
        $('#categorySubmit').show();
        $('#categoryUpdate').hide();
        $('#categoryModal').modal('show');
    }

    // Open Edit Modal
    function openEditModal(categoryId, description) {
        isEditMode = true;
        editingCategoryId = categoryId;
        $('#categoryModalLabel').text('Edit Category');
        $('#category_description').val(description);
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

    // Handle Save Button Click
    $('#categorySubmit').on('click', function() {
        const formData = {
            description: $('#category_description').val().trim()
        };

        if (!formData.description) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please enter a category description.'
            });
            return;
        }

        $.ajax({
            url: '/api/category',
            type: 'POST',
            data: JSON.stringify(formData),
            contentType: 'application/json',
            success: function(response) {
                if (response.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: 'Category created successfully!'
                    }).then(() => {
                        $('#categoryModal').modal('hide');
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
        const formData = {
            description: $('#category_description').val().trim()
        };

        if (!formData.description) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please enter a category description.'
            });
            return;
        }

        $.ajax({
            url: `/api/category/${editingCategoryId}`,
            type: 'PUT',
            data: JSON.stringify(formData),
            contentType: 'application/json',
            success: function(response) {
                if (response.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: 'Category updated successfully!'
                    }).then(() => {
                        $('#categoryModal').modal('hide');
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
                    success: function(response) {
                        if (response.success) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Deleted!',
                                text: response.message
                            }).then(() => {
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

    // Reset form when modal is closed
    $('#categoryModal').on('hidden.bs.modal', function() {
        $('#cform')[0].reset();
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
});