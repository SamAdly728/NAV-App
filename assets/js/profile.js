// image uploader
function readURL(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();

        reader.onload = function (e) {
            const imgPreview = $('#imgPreview');
            imgPreview.css('background-image', `url(${e.target.result})`);
            imgPreview.hide().fadeIn(650);
        };

        reader.readAsDataURL(input.files[0]);
    }
}

$('#imageUpload').on('change', function () {
    readURL(this);
});

//  **------tab js**
$(document).on('click', '.tab-link', function () {
    const tabID = $(this).attr('data-tab');

    $(this).addClass('active').siblings().removeClass('active');

    $('#tab-' + tabID).addClass('active').siblings().removeClass('active');
});

//  **------image js**
GLightbox({
    touchNavigation: true,
    loop: true,
    width: "90vw",
    height: "90vh",
});

//  **-----post js**

const filepondTarget = document.querySelector('.filepond-file');
if (filepondTarget) {
    FilePond.registerPlugin(FilePondPluginFileValidateType);
    FilePond.registerPlugin(FilePondPluginImagePreview);
    FilePond.registerPlugin(FilePondPluginFileEncode);
    FilePond.registerPlugin(FilePondPluginFileValidateSize);
    FilePond.registerPlugin(FilePondPluginImageExifOrientation);

    FilePond.create(filepondTarget, {
        labelIdle: `<i class="fa-solid fa-cloud-upload fa-fw fs-4"></i> <div class="filepond--label-action text-decoration-none">Upload Your Files</div>`,
    });

    const pondInputTarget = document.querySelector('#id');
    if (pondInputTarget) {
        FilePond.create(pondInputTarget, {
            labelIdle: `<i class="fa-solid fa-cloud-upload fa-fw fs-4"></i> <div class="filepond--label-action text-decoration-none">Upload Your Files</div>`,
        });
    }
}

//  **------post gallery js**
GLightbox({
    touchNavigation: true,
    loop: true,
    width: "90vw",
    height: "90vh",
});


//  **------ slider**
$('.story-container').slick({
    slidesToShow: 4,
    slidesToScroll: 1,
    autoplay: true,
    arrows: false,
    autoplaySpeed: 1000,
    responsive: [
        {
            breakpoint: 1366,
            settings: {
                slidesToShow: 2
            }
        },
        {
            breakpoint: 992,
            settings: {
                slidesToShow: 4
            }
        },
        {
            breakpoint: 567,
            settings: {
                slidesToShow: 2,
            }
        },
    ]
});

// FollowButton
document.addEventListener("DOMContentLoaded", () => {
    const followButton = document.getElementById("followButton");

    if (!followButton) return;

    followButton.addEventListener("click", () => {
        const currentText = followButton.textContent.trim().toLowerCase();
        const isFollowing = currentText === "follow";

        followButton.innerHTML = isFollowing
            ? '<i class="ti ti-user-check"></i> Following'
            : '<i class="ti ti-user"></i> Follow';

        followButton.classList.toggle("btn-primary", !isFollowing);
        followButton.classList.toggle("btn-success", isFollowing);
    });
});


// -- Profile Data Fetching & Saving --

function fetchProfilePageData() {
    $.ajax({
        url: '/api/me',
        method: 'GET',
        success: function (data) {
            if (data.user) {
                const user = data.user;

                // Update Profile Card
                $('#profileCardName').text(user.full_name || user.username);
                $('#profileCardBio').text(user.bio || 'No bio available');

                // Update About Me Section
                $('#aboutWorkPassion').text(user.work_passion || 'Not specified');
                $('#aboutEmail').text(user.email || 'Not specified');
                $('#aboutContact').text(user.phone || 'Not specified');
                $('#aboutBirthDate').text(user.birth_date || 'Not specified');
                $('#aboutLocation').text(user.location || 'Not specified');
                $('#aboutWebsite').text(user.website || 'Not specified');
                $('#aboutGithub').text(user.github || 'Not specified');

                // Store user data for modal population
                window.currentUserData = user;
            }
        },
        error: function (err) {
            console.error('Failed to fetch profile data', err);
        }
    });
}

$(document).ready(function () {
    // Fetch data on load
    fetchProfilePageData();

    // Edit Profile Button Click - Populate Modal
    $('#editProfileBtn').on('click', function () {
        const user = window.currentUserData || {};
        $('#editFullName').val(user.full_name || '');
        $('#editPhone').val(user.phone || '');
        $('#editBio').val(user.bio || '');
        $('#editWorkPassion').val(user.work_passion || '');
        $('#editBirthDate').val(user.birth_date || '');
        $('#editLocation').val(user.location || '');
        $('#editWebsite').val(user.website || '');
        $('#editGithub').val(user.github || '');
    });

    // Save Profile Button Click
    $('#saveProfileBtn').on('click', function () {
        const formData = {
            full_name: $('#editFullName').val(),
            phone: $('#editPhone').val(),
            bio: $('#editBio').val(),
            work_passion: $('#editWorkPassion').val(),
            birth_date: $('#editBirthDate').val(),
            location: $('#editLocation').val(),
            website: $('#editWebsite').val(),
            github: $('#editGithub').val()
        };

        $.ajax({
            url: '/api/me',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function (response) {
                // Close modal
                const modalEl = document.getElementById('editProfileModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();

                // Refresh data
                fetchProfilePageData();

                // Also refresh global header data if name changed
                if (typeof fetchGlobalUserData === 'function') {
                    fetchGlobalUserData();
                }

                // Show success message (using Swal if available, else alert)
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Profile Updated',
                        text: 'Your profile has been updated successfully!',
                        timer: 1500,
                        showConfirmButton: false
                    });
                } else {
                    alert('Profile updated successfully!');
                }
            },
            error: function (err) {
                console.error('Failed to update profile', err);
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Failed to update profile. Please try again.'
                    });
                } else {
                    alert('Failed to update profile.');
                }
            }
        });
    });
});
