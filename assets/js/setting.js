// delete button js //

$('#account_delete').on('click', function () {
  Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, delete it!'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire(
        'Deleted!',
        'Your file has been deleted.',
        'success'
      )
    }
  })
})

//  chart js
const timeSpentOptions = {
  series: [{
    name: 'Spent Time',
    type: 'column',
    data: [35, 45, 32, 40, 35, 38, 40]
  }, {
    name: 'Total Time',
    type: 'line',
    data: [30, 25, 36, 30, 40, 35]
  }],
  chart: {
    height: 280,
    type: 'line',
    stacked: false,
  },
  annotations: {
    points: [{
      x: 'S',
      y: 35,
      marker: {
        size: 5,
        colors: '#fff',
        strokeColor: 'rgba(var(--warning),1)',
        strokeWidth: 4,
        cssClass: 'marker-warning',
      }
    }],
  },
  stroke: {
    width: [0, 2, 5],
    curve: 'smooth'
  },
  plotOptions: {
    bar: {
      columnWidth: '80'
    }
  },
  legend: {
    show: false,
  },
  colors: ['rgba(var(--warning),1)'],
  fill: {
    type: ["gradient", "solid"],
    opacity: [0.8, .1],
    gradient: {
      inverseColors: false,
      shade: 'light',
      type: "vertical",
      opacityFrom: 0.1,
      opacityTo: 0.1,
      colorStops: [
        {
          offset: 0,
          color: 'rgba(var(--primary),.1)',
          opacity: 1,
        },
        {
          offset: 50,
          color: 'rgba(var(--primary),.1)',
          opacity: 1,
        },
        {
          offset: 100,
          color: 'rgba(var(--primary),.1)',
          opacity: 1,
        },
      ],
    }
  },
  markers: {
    size: 0
  },
  xaxis: {
    type: 'category',
    categories: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    tooltip: {
      enabled: false
    },
    axisBorder: {
      show: false,
    }
  },
  yaxis: {
    show: false,
  },
  grid: {
    show: false,
    xaxis: {
      lines: {
        show: false
      }
    },
    yaxis: {
      lines: {
        show: false
      }
    },
  },
  tooltip: {
    x: {
      show: false,
    },
    style: {
      fontSize: '16px',
      fontFamily: '"Outfit", sans-serif',
    },
  },
  // responsive: [{
  //   breakpoint: 1440,
  //   options: {
  //     chart: {
  //       height: 200
  //     },
  //   }
  // }]
};

const timeSpentChart = new ApexCharts(document.querySelector("#timeSpent"), timeSpentOptions);
timeSpentChart.render();


// language selection //
$(function () {
  $('.select-language').select2();
});

function setupPasswordToggle(toggleId, inputId, iconClass) {
  const toggleBtn = document.querySelector(toggleId);
  const passwordInput = document.getElementById(inputId);
  const toggleIcon = document.querySelector(iconClass);

  if (!toggleBtn || !passwordInput || !toggleIcon) return;

  toggleBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    toggleIcon.classList.toggle("ph-eye", isPassword);
    toggleIcon.classList.toggle("ph-eye-slash", !isPassword);
  });
}

// Apply to each password field
setupPasswordToggle("#showPassword", "password", ".eyes-icon");
setupPasswordToggle("#showPassword1", "password1", ".eyes-icon1");
setupPasswordToggle("#showPassword2", "password2", ".eyes-icon2");


//  **------image js**
GLightbox({
  touchNavigation: true,
  loop: true,
  width: "90vw",
  height: "90vh",
});

// ==========================================
// Settings Page Data Connection
// ==========================================

$(document).ready(function () {
  // 1. Fetch User Data on Load
  fetchUserData();

  // 2. Handle Profile Form Submission
  $('#profileForm').on('submit', function (e) {
    e.preventDefault();
    updateUserProfile();
  });
});

function fetchUserData() {
  $.ajax({
    url: '/api/me',
    method: 'GET',
    success: function (data) {
      // Populate Profile Fields
      if (data.user) {
        $('#inputUsername').val(data.user.username || data.user.full_name);
        $('#inputEmail').val(data.user.email);
        $('#inputAddress').val(data.user.address);
        $('#inputAddress2').val(data.user.address2);
        $('#inputCity').val(data.user.city);
        $('#inputState').val(data.user.state);
        $('#inputZip').val(data.user.zip);
        $('#inputLanguage').val(data.user.language).trigger('change');

        // Update Profile Pic
        if (data.user.avatar_url) {
          $('.profile-image').css('background-image', `url(${data.user.avatar_url})`);
          $('#imgPreview').css('background-image', `url(${data.user.avatar_url})`);
        }
      }
    },
    error: function (err) {
      console.error('Failed to fetch user data', err);
      // Silent fail or toast? Swal might be annoying on load if auth fails
    }
  });
}

function updateUserProfile() {
  const formData = {
    username: $('#inputUsername').val(),
    address: $('#inputAddress').val(),
    address2: $('#inputAddress2').val(),
    city: $('#inputCity').val(),
    state: $('#inputState').val(),
    zip: $('#inputZip').val(),
    language: $('#inputLanguage').val()
  };

  $.ajax({
    url: '/api/me',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify(formData),
    success: function (response) {
      Swal.fire('Success', 'Profile updated successfully', 'success');
    },
    error: function (err) {
      console.error('Update failed', err);
      Swal.fire('Error', 'Failed to update profile', 'error');
    }
  });
}


// 3. Handle Users Tab Click
$('#users-tab').on('shown.bs.tab', function () {
  fetchUsers();
});

function fetchUsers() {
  $.ajax({
    url: '/api/users',
    method: 'GET',
    success: function (users) {
      const tbody = $('#usersTable tbody');
      tbody.empty();
      users.forEach(user => {
        const row = `
          <tr>
            <td>${user.id}</td>
            <td>${user.full_name || '-'}</td>
            <td>${user.username || '-'}</td>
            <td>${user.email}</td>
            <td>${user.role || 'user'}</td>
          </tr>
        `;
        tbody.append(row);
      });
    },
    error: function (err) {
      console.error('Failed to fetch users', err);
    }
  });
}

// 4. Handle Integrations Tab
$('#integrations-tab').on('shown.bs.tab', function () {
  fetchGhlSettings();
});

function fetchGhlSettings() {
  $.ajax({
    url: '/api/settings/ghl',
    method: 'GET',
    success: function (data) {
      if (data.isConfigured) {
        $('#ghlApiKey').val(data.apiKey); // Will be masked
      }
      $('#ghlLocationId').val(data.locationId);
    },
    error: function (err) {
      console.error('Failed to fetch GHL settings', err);
    }
  });
}

$('#ghlForm').on('submit', function (e) {
  e.preventDefault();
  const formData = {
    apiKey: $('#ghlApiKey').val(),
    locationId: $('#ghlLocationId').val()
  };

  $.ajax({
    url: '/api/settings/ghl',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify(formData),
    success: function (response) {
      Swal.fire('Success', 'Settings saved successfully', 'success');
      fetchGhlSettings(); // Refresh to ensure correct state/masking
    },
    error: function (err) {
      console.error('Failed to save settings', err);
      Swal.fire('Error', 'Failed to save settings', 'error');
    }
  });
});

$('#toggleGhlKey').on('click', function () {
  const input = $('#ghlApiKey');
  const icon = $(this).find('i');
  if (input.attr('type') === 'password') {
    input.attr('type', 'text');
    icon.removeClass('ph-eye').addClass('ph-eye-slash');
  } else {
    input.attr('type', 'password');
    icon.removeClass('ph-eye-slash').addClass('ph-eye');
  }
});



