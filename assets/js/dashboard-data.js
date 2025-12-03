/**
 * Dashboard Data Management
 * Handles fetching and rendering of dynamic user data
 */

(function () {
    'use strict';

    // Function to fetch and update user profile data
    async function loadUserProfile() {
        try {
            const response = await fetch('/api/me', { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to fetch user data');

            const userData = await response.json();
            if (!userData) return;

            // Update Role Label (Index Page)
            const roleLabel = document.getElementById('dashboardRoleLabel');
            if (roleLabel) {
                roleLabel.textContent = userData.role === 'admin' ? 'Admin Dashboard' : 'Client Dashboard';

                // Update Email/Subtitle (Index Page)
                // Only update if we are on the index page (roleLabel exists)
                const profileContainer = document.querySelector('.nav-profile .flex-grow-1');
                if (profileContainer) {
                    const subtitle = profileContainer.querySelector('p.text-muted');
                    if (subtitle) {
                        subtitle.textContent = userData.email;
                        subtitle.title = userData.email;
                    }
                }
            }

            // Update Profile Page Header
            const profileName = document.getElementById('profileName');
            if (profileName) {
                profileName.textContent = userData.full_name || userData.email;
                profileName.title = userData.email;
            }

            const profileRole = document.getElementById('profileRole');
            if (profileRole) {
                profileRole.textContent = userData.role;
            }

            // Update Profile Card (Main Content)
            const profileCardName = document.getElementById('profileCardName');
            if (profileCardName) {
                profileCardName.textContent = userData.full_name || userData.email;
            }

            const profileCardBio = document.getElementById('profileCardBio');
            if (profileCardBio) {
                profileCardBio.textContent = userData.bio || 'No bio available';
            }

            // Update About Me Section
            const aboutWorkPassion = document.getElementById('aboutWorkPassion');
            if (aboutWorkPassion) aboutWorkPassion.textContent = userData.work_passion || 'Not set';

            const aboutEmail = document.getElementById('aboutEmail');
            if (aboutEmail) aboutEmail.textContent = userData.email;

            const aboutContact = document.getElementById('aboutContact');
            if (aboutContact) aboutContact.textContent = userData.phone || 'Not set';

            const aboutBirthDate = document.getElementById('aboutBirthDate');
            if (aboutBirthDate) aboutBirthDate.textContent = userData.birth_date || 'Not set';

            const aboutLocation = document.getElementById('aboutLocation');
            if (aboutLocation) aboutLocation.textContent = userData.location || 'Not set';

            const aboutWebsite = document.getElementById('aboutWebsite');
            if (aboutWebsite) aboutWebsite.textContent = userData.website || 'Not set';

            const aboutGithub = document.getElementById('aboutGithub');
            if (aboutGithub) aboutGithub.textContent = userData.github || 'Not set';

            // Populate Edit Form
            const editFullName = document.getElementById('editFullName');
            if (editFullName) editFullName.value = userData.full_name || '';

            const editPhone = document.getElementById('editPhone');
            if (editPhone) editPhone.value = userData.phone || '';

            const editBio = document.getElementById('editBio');
            if (editBio) editBio.value = userData.bio || '';

            const editWorkPassion = document.getElementById('editWorkPassion');
            if (editWorkPassion) editWorkPassion.value = userData.work_passion || '';

            const editBirthDate = document.getElementById('editBirthDate');
            if (editBirthDate) editBirthDate.value = userData.birth_date || '';

            const editLocation = document.getElementById('editLocation');
            if (editLocation) editLocation.value = userData.location || '';

            const editWebsite = document.getElementById('editWebsite');
            if (editWebsite) editWebsite.value = userData.website || '';

            const editGithub = document.getElementById('editGithub');
            if (editGithub) editGithub.value = userData.github || '';

            // Update Avatar (Common)
            if (userData.avatar) {
                const avatarImgs = document.querySelectorAll('.nav-profile img, .profile-image img, .profile-pic img'); // Broaden selector
                avatarImgs.forEach(img => {
                    img.src = userData.avatar;
                });
            }

        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }

    // Handle Edit Profile Form Submission
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            const full_name = document.getElementById('editFullName').value;
            const phone = document.getElementById('editPhone').value;
            const bio = document.getElementById('editBio').value;
            const work_passion = document.getElementById('editWorkPassion').value;
            const birth_date = document.getElementById('editBirthDate').value;
            const location = document.getElementById('editLocation').value;
            const website = document.getElementById('editWebsite').value;
            const github = document.getElementById('editGithub').value;

            try {
                const response = await fetch('/api/me', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        full_name, phone, bio,
                        work_passion, birth_date, location, website, github
                    })
                });

                if (response.ok) {
                    // Reload user data to update UI
                    loadUserProfile();
                    // Close modal
                    const modalEl = document.getElementById('editProfileModal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    modal.hide();
                } else {
                    console.error('Failed to update profile');
                    alert('Failed to update profile');
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                alert('Error updating profile');
            }
        });
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        loadUserProfile();
    });

})();
